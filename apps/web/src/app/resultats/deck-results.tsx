"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api";
import {
  isUnlocked,
  loadSession,
  saveSession,
  setUnlocked,
  type StoredMatch,
  type StoredPortrait,
  type StoredRefinedBatch,
  type StoredSession,
} from "@/lib/storage";
import { seedDevSession } from "@/lib/dev-seed";
import AlertBanner from "@/components/alert-banner";
import InlineEmailCapture from "./inline-email-capture";
import SessionRestore from "./session-restore";
import SwipeDeck, { type SwipeDirection } from "./swipe-deck";
import type { SwipeCardData } from "./swipe-card";

/**
 * Page `/resultats` en mode swipe deck (Phase C).
 *
 * Machine d'états :
 *
 *     deck ──swipe dernière carte──> handleRoundEnd
 *      ▲                              │
 *      │                              ├─ round 0 + !paid ─> paywall ─pay─> fetching
 *      │                              ├─ paid + hasMore   ─> fetching
 *      │                              └─ !hasMore         ─> exhausted
 *      │
 *      └── inter-batch (1.8 s) <── fetching (succès)
 *
 * Le tour ("round") = paquet de cartes en cours : tour 0 = 3 cartes gratuites
 * de la passe 1 ; tour 1+ = paquets affinés reçus de `/next-batch`.
 */

/** Nombre de cartes gratuites montrées avant le paywall. */
const FREE_CARDS = 3;
/** Durée d'affichage de l'écran "nouveau paquet" entre deux tours. */
const INTER_BATCH_PAUSE_MS = 1800;

type Screen =
  | { kind: "deck" }
  | { kind: "paywall" }
  | { kind: "fetching" }
  | { kind: "inter-batch"; insight: string }
  | { kind: "exhausted" };

/** Source de cartes pour un tour donné (passe gratuite ou paquet affiné). */
function getRoundSource(
  session: StoredSession,
  roundIndex: number,
): StoredMatch[] {
  if (roundIndex === 0) return session.matches.slice(0, FREE_CARDS);
  return session.batches?.[roundIndex - 1]?.matches ?? [];
}

/**
 * Détermine sur quel tour reprendre lors du chargement initial — premier tour
 * dont au moins une carte n'a pas encore été notée.
 */
function computeInitialRound(session: StoredSession): number {
  const rated = new Set(Object.keys(session.ratings ?? {}));
  const round0 = session.matches.slice(0, FREE_CARDS);
  if (round0.some((m) => !rated.has(m.job.slug))) return 0;
  const batches = session.batches ?? [];
  for (let i = 0; i < batches.length; i++) {
    if (batches[i].matches.some((m) => !rated.has(m.job.slug))) return i + 1;
  }
  // Tous tours entièrement notés : on pointe sur le dernier paquet existant
  // (handleRoundEnd décidera de fetch ou d'afficher l'écran de fin).
  return batches.length;
}

/** Convertit un StoredMatch (storage) en SwipeCardData (composant deck). */
function toSwipeCard(m: StoredMatch): SwipeCardData {
  return {
    slug: m.job.slug,
    title: m.job.title,
    tagline: m.job.tagline,
    scorePercent: m.scorePercent,
    summary: m.job.summary,
    rationale: m.rationale ?? null,
    missions: m.job.missions,
    skills: m.job.skills,
    salaryRangeHint: m.job.salaryRangeHint,
  };
}

export default function DeckResults() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlSessionId = searchParams.get("sessionId");

  const [session, setSession] = useState<StoredSession | null>(null);
  const [roundIndex, setRoundIndex] = useState(0);
  const [screen, setScreen] = useState<Screen>({ kind: "deck" });
  const [roundCards, setRoundCards] = useState<StoredMatch[]>([]);
  const [stripeOn, setStripeOn] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const [needsEmailForPayment, setNeedsEmailForPayment] = useState(false);
  /**
   * Promises des POST /rate en cours. handleRoundEnd les attend avant
   * d'appeler /next-batch — sinon le backend pourrait répondre 400
   * "pas assez de nouvelles notes" alors qu'elles sont juste en vol.
   */
  const pendingRates = useRef<Promise<unknown>[]>([]);

  // ── Chargement initial de la session ───────────────────────────
  useEffect(() => {
    if (process.env.NODE_ENV === "development" && searchParams.get("seed") === "1") {
      seedDevSession();
    }
    const s = loadSession();
    setSession(s);
    if (s) setRoundIndex(computeInitialRound(s));
  }, []);

  // ── Stripe configuré côté API ? ────────────────────────────────
  useEffect(() => {
    void (async () => {
      try {
        const s = await apiGet<{ stripeEnabled: boolean }>(
          "/v1/billing/status",
        );
        setStripeOn(s.stripeEnabled);
      } catch {
        setStripeOn(false);
      }
    })();
  }, []);

  /** Met à jour la session locale + persiste en sessionStorage. */
  const persist = useCallback((next: StoredSession) => {
    setSession(next);
    const { savedAt: _, ...rest } = next;
    saveSession({ ...rest });
  }, []);

  /** Appelle `/next-batch` et enchaîne sur l'écran de transition + nouveau tour. */
  const fetchNextBatch = useCallback(
    async (s: StoredSession) => {
      setScreen({ kind: "fetching" });
      try {
        const result = await apiPost<{
          batchNumber: number;
          matches: StoredMatch[];
          insight: string;
          hasMore: boolean;
        }>(`/v1/questionnaire/${s.sessionId}/next-batch`, {});

        // Backend signale qu'il n'a plus rien à proposer.
        if (result.matches.length === 0) {
          persist({ ...s, hasMore: false });
          setScreen({ kind: "exhausted" });
          return;
        }

        const newBatch: StoredRefinedBatch = {
          batchNumber: result.batchNumber,
          matches: result.matches,
          insight: result.insight,
        };
        const newBatches = [...(s.batches ?? []), newBatch];
        persist({ ...s, batches: newBatches, hasMore: result.hasMore });

        // Affiche l'insight quelques secondes puis bascule sur le nouveau tour.
        setScreen({ kind: "inter-batch", insight: result.insight });
        setRoundIndex(newBatches.length);
        setTimeout(
          () => setScreen({ kind: "deck" }),
          INTER_BATCH_PAUSE_MS,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message.toLowerCase() : "";
        setVerifyMsg(
          msg.includes("note")
            ? "Note encore quelques métiers pour débloquer un nouveau paquet."
            : "Impossible de générer un nouveau paquet. Réessaie dans un instant.",
        );
        setScreen({ kind: "deck" });
      }
    },
    [persist],
  );

  // ── Retour depuis Stripe ─────────────────────────────────────────
  // Stripe redirige vers /resultats?session_id=cs_xxx après paiement.
  // On vérifie côté serveur (clé secrète Stripe) avant de déverrouiller.
  // isUnlocked() en guard évite de rappeler l'API si l'effet se re-déclenche
  // après le persist() qui suit (session change → deps change → re-run).
  useEffect(() => {
    const stripeSessionId = searchParams.get("session_id");
    if (!stripeSessionId || !session || isUnlocked()) return;
    void (async () => {
      try {
        const r = await apiGet<{ paid: boolean }>(
          `/v1/billing/session?session_id=${encodeURIComponent(stripeSessionId)}`,
        );
        if (r.paid) {
          setUnlocked();
          const updated = { ...session, hasEmail: true };
          persist(updated);
          await fetchNextBatch(updated);
        } else {
          setVerifyMsg("Session de paiement non finalisée.");
        }
      } catch {
        setVerifyMsg("Impossible de vérifier le paiement.");
      }
    })();
  }, [searchParams, session, persist, fetchNextBatch]);

  /** Décide quoi faire quand toutes les cartes du tour ont été swipées. */
  const handleRoundEnd = useCallback(
    async (s: StoredSession) => {
      // Attend les /rate en vol pour que le backend ait l'historique à jour.
      await Promise.all(pendingRates.current);
      pendingRates.current = [];

      const unlocked = isUnlocked();
      // Tour 0 (gratuit) fini sans paiement → paywall.
      if (roundIndex === 0 && !unlocked) {
        setScreen({ kind: "paywall" });
        return;
      }
      // Backend a déjà dit qu'il n'y avait plus de paquets dispo.
      if (s.hasMore === false) {
        setScreen({ kind: "exhausted" });
        return;
      }
      await fetchNextBatch(s);
    },
    [roundIndex, fetchNextBatch],
  );

  // ── Snapshot des cartes du tour : stable pendant qu'on swipe ───
  // Se recalcule UNIQUEMENT au changement de tour (et au chargement initial),
  // pas à chaque notation — sinon le deck (qui maintient son propre index)
  // sauterait des cartes.
  useEffect(() => {
    if (!session) return;
    const source = getRoundSource(session, roundIndex);
    const rated = new Set(Object.keys(session.ratings ?? {}));
    const cards = source.filter((m) => !rated.has(m.job.slug));
    setRoundCards(cards);

    if (cards.length === 0) {
      // Tour déjà vide à l'arrivée (resume après refresh, ou fin de tour).
      void handleRoundEnd(session);
    } else if (
      screen.kind !== "deck" &&
      screen.kind !== "inter-batch" &&
      screen.kind !== "fetching"
    ) {
      setScreen({ kind: "deck" });
    }
    // session?.sessionId stable hors changement de session ; roundIndex change
    // explicitement à chaque transition de tour — c'est ce qu'on veut.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.sessionId, roundIndex]);

  // ── Retour Stripe : vérifie + déclenche le 1er paquet affiné ───
  useEffect(() => {
    const stripeSessionId = searchParams.get("session_id");
    if (!stripeSessionId || !session) return;
    void (async () => {
      try {
        const r = await apiGet<{ paid: boolean }>(
          `/v1/billing/session?session_id=${encodeURIComponent(stripeSessionId)}`,
        );
        if (r.paid) {
          setUnlocked();
          const updated: StoredSession = { ...session, hasEmail: true };
          persist(updated);
          setVerifyMsg(
            "Paiement confirmé — on génère ton premier paquet affiné…",
          );
          await fetchNextBatch(updated);
        } else {
          setVerifyMsg("Session de paiement non finalisée.");
        }
      } catch {
        setVerifyMsg("Impossible de vérifier le paiement.");
      }
    })();
    // Volontairement déclenché uniquement par l'arrivée du retour Stripe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ── Callbacks UI ───────────────────────────────────────────────

  /** Enregistre la note d'une carte swipée (POST /rate + state local). */
  const onSwipe = useCallback(
    (slug: string, direction: SwipeDirection) => {
      if (!session) return;
      const rating: "like" | "dislike" | "neutral" = direction;
      const p = apiPost(`/v1/questionnaire/${session.sessionId}/rate`, {
        jobSlug: slug,
        rating,
      }).catch(() => {
        // Silencieux : la note reste en localStorage, le backend la verra
        // au prochain /next-batch via DB si elle a été persistée, sinon
        // c'est dégradé sans bloquer l'UX.
      });
      pendingRates.current.push(p);
      persist({
        ...session,
        ratings: { ...session.ratings, [slug]: rating },
      });
    },
    [session, persist],
  );

  /** Appelé quand la dernière carte du tour a été swipée. */
  const onDeckEmpty = useCallback(() => {
    if (!session) return;
    void handleRoundEnd(session);
  }, [session, handleRoundEnd]);

  /** Lance le checkout Stripe (paywall). */
  const onCheckout = useCallback(async () => {
    if (!session) return;
    setCheckoutLoading(true);
    try {
      const res = await apiPost<{ url: string }>(
        "/v1/billing/checkout/full-report",
        {
          successPath: "/resultats",
          cancelPath: "/resultats",
          sessionId: session.sessionId,
        },
      );
      window.location.href = res.url;
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("EMAIL_REQUIRED")) {
        setNeedsEmailForPayment(true);
      } else {
        setVerifyMsg(
          "Paiement indisponible : configure STRIPE_SECRET_KEY et STRIPE_PRICE_FULL_REPORT sur l'API.",
        );
      }
    } finally {
      setCheckoutLoading(false);
    }
  }, [session]);

  const onEmailCapturedForPayment = useCallback(() => {
    setNeedsEmailForPayment(false);
    if (session) persist({ ...session, hasEmail: true });
    void onCheckout();
  }, [session, persist, onCheckout]);

  /** Ouvre la fiche métier complète (avec le rang global pour le paywall fiche). */
  const onOpenSheet = useCallback(
    (slug: string) => {
      if (!session) return;

      // Cherche d'abord dans les matches initiaux (passe gratuite)
      const initialIdx = session.matches.findIndex((m) => m.job.slug === slug);
      if (initialIdx >= 0) {
        router.push(
          `/metiers/${slug}?sessionId=${session.sessionId}&rank=${initialIdx + 1}`,
        );
        return;
      }

      // Carte d'un batch affiné : rang global = après tous les matches initiaux.
      // isUnlocked() est true pour les utilisateurs payants → pas de paywall quoi qu'il arrive.
      const allBatchMatches = (session.batches ?? []).flatMap((b) => b.matches);
      const batchIdx = allBatchMatches.findIndex((m) => m.job.slug === slug);
      const rank =
        batchIdx >= 0
          ? session.matches.length + batchIdx + 1
          : session.matches.length + 1;

      router.push(
        `/metiers/${slug}?sessionId=${session.sessionId}&rank=${rank}`,
      );
    },
    [router, session],
  );

  // ── Cas d'entrée 1 : lien email sans session locale ────────────
  if (urlSessionId && !session) {
    return (
      <SessionRestore
        sessionId={urlSessionId}
        onRestored={() => {
          const s = loadSession();
          setSession(s);
          if (s) setRoundIndex(computeInitialRound(s));
        }}
      />
    );
  }

  // ── Cas d'entrée 2 : aucune session ────────────────────────────
  if (!session) {
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <p className="text-lg text-slate-600 dark:text-slate-300">
          Aucun résultat en session. Lance d&apos;abord le questionnaire.
        </p>
        <Link
          href="/questionnaire"
          className="mt-6 inline-block rounded-full bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-500"
        >
          Questionnaire
        </Link>
      </div>
    );
  }

  // ── Rendu principal ────────────────────────────────────────────
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 py-8 md:max-w-2xl">
      <div className="mb-3 flex items-center justify-between">
        <Link
          href="/"
          className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
        >
          ← Accueil
        </Link>
        <Link
          href="/questionnaire"
          className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
        >
          Refaire le questionnaire
        </Link>
      </div>

      {session.portrait && <CompactPortrait portrait={session.portrait} />}

      {verifyMsg && (
        <AlertBanner message={verifyMsg} variant="error" className="mt-3" />
      )}

      <div className="mt-4 flex-1">
        {screen.kind === "deck" && roundCards.length > 0 && (
          <SwipeDeck
            key={roundIndex}
            cards={roundCards.map(toSwipeCard)}
            onSwipe={onSwipe}
            onEmpty={onDeckEmpty}
            onOpenSheet={onOpenSheet}
          />
        )}

        {screen.kind === "paywall" && (
          <PaywallScreen
            session={session}
            stripeOn={stripeOn}
            checkoutLoading={checkoutLoading}
            needsEmailForPayment={needsEmailForPayment}
            onCheckout={() => void onCheckout()}
            onEmailCapturedForPayment={onEmailCapturedForPayment}
            onCancelEmail={() => setNeedsEmailForPayment(false)}
          />
        )}

        {screen.kind === "fetching" && (
          <CenterMsg>
            <p className="animate-pulse text-sm text-slate-500">
              L&apos;IA affine ton prochain paquet de métiers…
            </p>
          </CenterMsg>
        )}

        {screen.kind === "inter-batch" && (
          <InterBatch insight={screen.insight} />
        )}

        {screen.kind === "exhausted" && <ExhaustedScreen session={session} />}
      </div>
    </main>
  );
}

// ─── Sous-composants ─────────────────────────────────────────────

function CenterMsg({ children }: { children: React.ReactNode }) {
  return <div className="flex h-60 items-center justify-center">{children}</div>;
}

/**
 * Bandeau portrait minimal : juste l'archétype sur une ligne, dépliable au tap
 * pour révéler le résumé + les forces. Évite la "compétition de place" avec
 * la pile de cartes sur mobile.
 */
function CompactPortrait({ portrait }: { portrait: StoredPortrait }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <section className="mt-3 rounded-2xl border border-indigo-200 bg-indigo-50/50 dark:border-indigo-900 dark:bg-indigo-950/20">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left"
        aria-expanded={expanded}
      >
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-500 dark:text-indigo-400">
            ✨ Ton portrait
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
            {portrait.archetype}
          </p>
        </div>
        <span
          className={`shrink-0 text-xs text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          ▼
        </span>
      </button>
      {expanded && (
        <div className="border-t border-indigo-200 px-4 pb-3 pt-2.5 dark:border-indigo-900">
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            {portrait.summary}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {portrait.strengths.map((force, i) => (
              <span
                key={i}
                className="rounded-full border border-indigo-200 bg-white px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:border-indigo-800 dark:bg-slate-900 dark:text-indigo-200"
              >
                {force}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function PaywallScreen(props: {
  session: StoredSession;
  stripeOn: boolean;
  checkoutLoading: boolean;
  needsEmailForPayment: boolean;
  onCheckout: () => void;
  onEmailCapturedForPayment: () => void;
  onCancelEmail: () => void;
}) {
  const ratings = props.session.ratings ?? {};
  const likes = Object.values(ratings).filter((v) => v === "like").length;
  const dislikes = Object.values(ratings).filter((v) => v === "dislike").length;
  return (
    <div className="mt-6 rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50/50 p-6 dark:border-indigo-900 dark:from-indigo-950/30 dark:to-purple-950/20">
      <h2 className="text-xl font-semibold tracking-tight">
        Tu as exploré tes 3 premières pistes
      </h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        👍 {likes} · 👎 {dislikes}
      </p>
      <p className="mt-5 text-sm font-medium text-slate-700 dark:text-slate-200">
        Débloque la suite :
      </p>
      <ul className="mt-2 flex flex-col gap-1.5 text-sm text-slate-700 dark:text-slate-300">
        <li>✦ De nouveaux métiers affinés à chaque paquet par l&apos;IA</li>
        <li>✦ Explications personnalisées sur chaque carte</li>
        <li>✦ Plan d&apos;action concret sur chaque fiche</li>
      </ul>
      {props.needsEmailForPayment ? (
        <div className="mt-4">
          <InlineEmailCapture
            sessionId={props.session.sessionId}
            onCaptured={props.onEmailCapturedForPayment}
            onCancel={props.onCancelEmail}
          />
        </div>
      ) : (
        <button
          type="button"
          disabled={props.checkoutLoading || !props.stripeOn}
          onClick={props.onCheckout}
          className="mt-5 rounded-full bg-indigo-600 px-6 py-3 text-sm font-medium text-white shadow hover:bg-indigo-500 disabled:opacity-60"
        >
          {props.checkoutLoading
            ? "Redirection…"
            : props.stripeOn
              ? "Débloquer · 15€"
              : "Paiement non configuré"}
        </button>
      )}
    </div>
  );
}

function InterBatch({ insight }: { insight: string }) {
  return (
    <div className="flex h-60 flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500 dark:text-indigo-400">
        ✨ Nouveau paquet affiné
      </p>
      <p className="max-w-md text-base leading-relaxed text-slate-700 dark:text-slate-200">
        {insight}
      </p>
    </div>
  );
}

function ExhaustedScreen({ session }: { session: StoredSession }) {
  const ratings = session.ratings ?? {};
  const likedSlugs = new Set(
    Object.entries(ratings)
      .filter(([, v]) => v === "like")
      .map(([slug]) => slug),
  );
  const allCards: StoredMatch[] = [
    ...session.matches.slice(0, FREE_CARDS),
    ...(session.batches ?? []).flatMap((b) => b.matches),
  ];
  const likedCards = allCards.filter((c) => likedSlugs.has(c.job.slug));
  return (
    <div className="mt-6">
      <h2 className="text-xl font-semibold tracking-tight">
        Tu as fait le tour des pistes
      </h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        On a exploré ensemble tous les métiers qu&apos;on a trouvés pour toi.
      </p>
      {likedCards.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            Tes coups de cœur
          </p>
          <ul className="flex flex-col gap-1.5">
            {likedCards.map((c) => (
              <li key={c.job.slug}>
                <Link
                  href={`/metiers/${c.job.slug}?sessionId=${session.sessionId}`}
                  className="text-sm text-slate-700 underline-offset-2 hover:underline dark:text-slate-200"
                >
                  → {c.job.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
