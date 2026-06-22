"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import ThemeToggle from "@/components/theme-toggle";
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

  /**
   * Miroir de `session` pour les callbacks (onSwipe) qui doivent lire les
   * notes les plus récentes sans dépendre de leur closure — sinon deux notes
   * rapprochées repartent du même état et la 2e écrase la 1re.
   */
  const sessionRef = useRef<StoredSession | null>(null);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  /** Met à jour la session locale + persiste en sessionStorage. */
  const persist = useCallback((next: StoredSession) => {
    sessionRef.current = next; // synchrone : la note suivante lit déjà ce state
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
      // On lit la session via la ref (et non la closure) pour fusionner sur les
      // notes déjà posées, même si plusieurs swipes s'enchaînent rapidement.
      const s = sessionRef.current;
      if (!s) return;
      const rating: "like" | "dislike" | "neutral" = direction;
      const p = apiPost(`/v1/questionnaire/${s.sessionId}/rate`, {
        jobSlug: slug,
        rating,
      }).catch(() => {
        // Silencieux : la note reste en localStorage, le backend la verra
        // au prochain /next-batch via DB si elle a été persistée, sinon
        // c'est dégradé sans bloquer l'UX.
      });
      pendingRates.current.push(p);
      persist({
        ...s,
        ratings: { ...s.ratings, [slug]: rating },
      });
    },
    [persist],
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
        <p className="text-lg text-ink-soft">
          Aucun résultat en session. Lance d&apos;abord le questionnaire.
        </p>
        <Link
          href="/questionnaire"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 font-semibold text-paper transition hover:bg-accent hover:text-white"
        >
          Questionnaire
          <ArrowRight className="size-4" />
        </Link>
      </div>
    );
  }

  // ── Rendu principal ────────────────────────────────────────────
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-[600px] flex-col px-5 pb-10 pt-6">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/questionnaire"
          className="inline-flex items-center gap-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-75"
        >
          <ArrowLeft className="size-4" /> Refaire le test
        </Link>
        <ThemeToggle />
      </div>

      <div className="mt-6 text-center">
        <h1 className="font-serif text-[clamp(30px,5vw,40px)] leading-tight tracking-tight">
          Tes pistes métiers
        </h1>
        <p className="mt-2 text-[15.5px] text-muted">
          Glisse à droite si ça t&apos;intéresse, à gauche sinon.
        </p>
      </div>

      {session.portrait && <CompactPortrait portrait={session.portrait} />}

      {verifyMsg && (
        <AlertBanner message={verifyMsg} variant="error" className="mt-3" />
      )}

      <div className="mt-5 flex-1">
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
            <p className="animate-pulse text-sm text-muted">
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
    <section className="mt-5 rounded-2xl border border-line bg-surface">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={expanded}
      >
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-ink">
            <Sparkles className="size-3" strokeWidth={1.8} /> Ton portrait
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-ink">
            {portrait.archetype}
          </p>
        </div>
        <ChevronDown
          className={`size-4 shrink-0 text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {expanded && (
        <div className="border-t border-line px-4 pb-3 pt-2.5">
          <p className="text-sm leading-relaxed text-ink-soft">
            {portrait.summary}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {portrait.strengths.map((force, i) => (
              <span
                key={i}
                className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent-ink"
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
  // Pistes gratuites likées — on garde un accès à leur fiche depuis le paywall,
  // sinon les cartes notées disparaissent du deck et deviennent inatteignables.
  const likedCards = props.session.matches
    .slice(0, FREE_CARDS)
    .map((m, i) => ({ match: m, rank: i + 1 }))
    .filter(({ match }) => ratings[match.job.slug] === "like");
  return (
    <div className="mt-6 rounded-3xl border border-line bg-surface p-7 shadow-[0_30px_60px_-38px_rgba(20,40,25,.28)]">
      <h2 className="font-serif text-2xl tracking-tight text-ink">
        Tu as exploré tes 3 premières pistes
      </h2>
      <p className="mt-2 flex items-center gap-4 text-sm text-muted">
        <span className="inline-flex items-center gap-1.5">
          <ThumbsUp className="size-4 text-ok" strokeWidth={1.9} /> {likes}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ThumbsDown className="size-4 text-no" strokeWidth={1.9} /> {dislikes}
        </span>
      </p>

      {/* Récap des pistes likées — lien vers chaque fiche pour ne pas les perdre. */}
      {likedCards.length > 0 && (
        <div className="mt-5 rounded-2xl border border-ok/30 bg-ok/[0.06] p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-ok">
            <ThumbsUp className="size-3.5" strokeWidth={2} /> Tes coups de cœur
          </p>
          <ul className="mt-2.5 flex flex-col gap-1.5">
            {likedCards.map(({ match, rank }) => (
              <li key={match.job.slug}>
                <Link
                  href={`/metiers/${match.job.slug}?sessionId=${props.session.sessionId}&rank=${rank}`}
                  className="inline-flex items-center gap-2 text-sm font-medium text-ink underline-offset-2 hover:text-accent-ink hover:underline"
                >
                  <ArrowRight className="size-4 text-accent" /> {match.job.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-5 text-sm font-medium text-ink">
        Débloque la suite :
      </p>
      <ul className="mt-3 flex flex-col gap-2 text-sm text-ink-soft">
        {[
          "De nouveaux métiers affinés à chaque paquet par l'IA",
          "Explications personnalisées sur chaque carte",
          "Plan d'action concret sur chaque fiche",
        ].map((f) => (
          <li key={f} className="flex gap-2.5">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
            {f}
          </li>
        ))}
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
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper transition hover:bg-accent hover:text-white disabled:cursor-not-allowed disabled:bg-line-strong disabled:text-surface disabled:hover:bg-line-strong"
        >
          {props.checkoutLoading
            ? "Redirection…"
            : props.stripeOn
              ? "Débloquer · 5,90 €"
              : "Paiement non configuré"}
          {props.stripeOn && !props.checkoutLoading && <ArrowRight className="size-4" />}
        </button>
      )}
    </div>
  );
}

function InterBatch({ insight }: { insight: string }) {
  return (
    <div className="flex h-60 flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-accent-ink">
        <Sparkles className="size-3.5" strokeWidth={1.8} /> Nouveau paquet affiné
      </p>
      <p className="max-w-md text-base leading-relaxed text-ink-soft">
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
    <div className="mt-6 text-center">
      <div className="mx-auto grid size-[88px] place-items-center rounded-full bg-accent-soft">
        <Check className="size-10 text-accent" strokeWidth={2.2} />
      </div>
      <h2 className="mt-6 font-serif text-[30px] leading-tight tracking-tight">
        Tu as fait le tour des pistes
      </h2>
      <p className="mx-auto mt-3 max-w-[32ch] text-[15.5px] text-ink-soft">
        On a exploré ensemble tous les métiers qu&apos;on a trouvés pour toi.
      </p>
      {likedCards.length > 0 && (
        <div className="mt-8 text-left">
          <p className="mb-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-accent-ink">
            Tes coups de cœur
          </p>
          <ul className="flex flex-col gap-2.5">
            {likedCards.map((c) => (
              <li key={c.job.slug}>
                <Link
                  href={`/metiers/${c.job.slug}?sessionId=${session.sessionId}`}
                  className="inline-flex items-center gap-2 text-sm font-medium text-ink underline-offset-2 hover:text-accent-ink hover:underline"
                >
                  <ArrowRight className="size-4 text-accent" /> {c.job.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
