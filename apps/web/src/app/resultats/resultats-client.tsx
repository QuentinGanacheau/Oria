"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api";
import {
  isUnlocked,
  loadSession,
  setUnlocked,
  type StoredSession,
} from "@/lib/storage";
import SessionRestore from "./session-restore";
import InlineEmailCapture from "./inline-email-capture";
import JobRatingButtons from "./job-rating-buttons";
import PortraitCard from "./portrait-card";
import RefinedResults from "./refined-results";

export default function ResultatsClient() {
  const searchParams = useSearchParams();
  const [session, setSession] = useState<StoredSession | null>(null);
  const [stripeOn, setStripeOn] = useState(false);
  const [refining, setRefining] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  /**
   * true → affiche le composant InlineEmailCapture avant de rediriger
   * vers Stripe (cas où l'utilisateur a skipé la capture email).
   */
  const [needsEmailForPayment, setNeedsEmailForPayment] = useState(false);
  /**
   * sessionId issu de ?sessionId= dans l'URL (lien email).
   * Non null = on vient d'un email, potentiellement pas de localStorage.
   */
  const urlSessionId = searchParams.get("sessionId");

  // Charge la session depuis localStorage au montage
  useEffect(() => {
    setSession(loadSession());
  }, []);

  // Vérifie si Stripe est configuré côté API
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

  // Retour depuis Stripe (payment_status via ?session_id=)
  useEffect(() => {
    const stripeSessionId = searchParams.get("session_id");
    if (!stripeSessionId) return;
    void (async () => {
      try {
        const r = await apiGet<{ paid: boolean }>(
          `/v1/billing/session?session_id=${encodeURIComponent(stripeSessionId)}`,
        );
        if (r.paid) {
          setUnlocked();
          // Met à jour hasEmail en localStorage si besoin (session payée = email garanti)
          const current = loadSession();
          if (current && !current.hasEmail) {
            setSession({ ...current, hasEmail: true });
          }
          setVerifyMsg("Paiement confirmé — classement complet débloqué.");
        } else {
          setVerifyMsg("Session de paiement non finalisée.");
        }
      } catch {
        setVerifyMsg("Impossible de vérifier le paiement.");
      }
    })();
  }, [searchParams]);

  const unlocked = isUnlocked();

  /**
   * Met à jour la note d'un métier en localStorage et dans le state.
   * L'appel API est fait dans `JobRatingButtons` — ici on gère juste le state local.
   */
  const onRated = (jobSlug: string, rating: "like" | "dislike" | "neutral") => {
    if (!session) return;
    const updated: typeof session = {
      ...session,
      ratings: { ...session.ratings, [jobSlug]: rating },
    };
    setSession(updated);
    // Persist dans localStorage
    const { savedAt: _, ...rest } = updated;
    void import("@/lib/storage").then(({ saveSession }) => {
      saveSession({ ...rest });
    });
  };

  /**
   * Déclenche la 2e passe de résultats affinés.
   * Appelle POST /v1/questionnaire/:sessionId/refine puis met à jour localStorage.
   */
  const onRefine = async () => {
    if (!session) return;
    setRefining(true);
    try {
      const result = await apiPost<{
        matches: StoredSession["matches"];
        insight: string;
      }>(`/v1/questionnaire/${session.sessionId}/refine`, {});

      const updated: typeof session = {
        ...session,
        refinedMatches: result.matches,
        refineInsight: result.insight,
      };
      setSession(updated);
      const { savedAt: _, ...rest } = updated;
      const { saveSession } = await import("@/lib/storage");
      saveSession({ ...rest });
    } catch (err) {
      setVerifyMsg(
        err instanceof Error ? err.message : "Erreur lors du raffinement.",
      );
    } finally {
      setRefining(false);
    }
  };

  /**
   * Déclenche le checkout Stripe.
   * Si l'API répond EMAIL_REQUIRED (user avait skipé la capture),
   * on affiche le formulaire email inline avant de retenter.
   */
  const onCheckout = async () => {
    setCheckoutLoading(true);
    try {
      const res = await apiPost<{ url: string }>(
        "/v1/billing/checkout/full-report",
        {
          successPath: "/resultats",
          cancelPath: "/resultats",
          sessionId: session?.sessionId,
        },
      );
      window.location.href = res.url;
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("EMAIL_REQUIRED")) {
        // L'utilisateur avait skipé la capture — on lui demande son email
        // directement ici avant de retenter le checkout.
        setNeedsEmailForPayment(true);
      } else {
        setVerifyMsg(
          "Paiement indisponible : configure STRIPE_SECRET_KEY et STRIPE_PRICE_FULL_REPORT sur l'API.",
        );
      }
    } finally {
      setCheckoutLoading(false);
    }
  };

  /**
   * Appelé par InlineEmailCapture quand l'email a bien été capturé.
   * On ferme le formulaire inline et on relance le checkout.
   */
  const onEmailCapturedForPayment = () => {
    setNeedsEmailForPayment(false);
    // Met à jour le flag hasEmail en mémoire (pas besoin de reload)
    if (session) {
      setSession({ ...session, hasEmail: true });
    }
    void onCheckout();
  };

  // ── Cas 1 : Vient d'un lien email + pas de session locale ──────────────────
  // On affiche le gate de restauration (email requis pour anti-partage).
  if (urlSessionId && !session) {
    return (
      <SessionRestore
        sessionId={urlSessionId}
        onRestored={() => setSession(loadSession())}
      />
    );
  }

  // ── Cas 2 : Pas de session du tout ─────────────────────────────────────────
  if (!session) {
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <p className="text-lg text-slate-600 dark:text-slate-300">
          Aucun résultat en session. Lance d'abord le questionnaire.
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

  const { matches } = session;
  const freeCount = 3;
  const visible = unlocked ? matches : matches.slice(0, freeCount);
  const hidden = unlocked ? [] : matches.slice(freeCount);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/"
          className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
        >
          ← Accueil
        </Link>
        <Link
          href="/questionnaire"
          className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
        >
          Refaire le questionnaire
        </Link>
      </div>

      <h1 className="text-3xl font-semibold tracking-tight">
        Tes pistes métiers
      </h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">
        Classement indicatif basé sur tes réponses (MVP). Les fiches détaillées
        sont accessibles depuis chaque carte.
      </p>

      {/* Portrait compact — donne du contexte aux métiers listés ensuite. */}
      <PortraitCard portrait={session.portrait} />

      {/* Invite à noter — visible avant les cartes, disparaît une fois que
          l'utilisateur a commencé à noter (au moins 1 note posée). */}
      {Object.keys(session.ratings ?? {}).length === 0 && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50/60 px-4 py-4 dark:border-indigo-900/50 dark:bg-indigo-950/20">
          <span className="mt-0.5 text-lg leading-none">💡</span>
          <div>
            <p className="text-sm font-medium text-indigo-900 dark:text-indigo-100">
              Note chaque métier pour affiner tes résultats
            </p>
            <p className="mt-0.5 text-sm text-indigo-700 dark:text-indigo-300">
              👍 / 👎 sur chaque carte — l&apos;IA s&apos;en sert pour te
              trouver <strong>5 nouvelles pistes encore plus adaptées</strong>{" "}
              à ce qui te correspond vraiment.
            </p>
          </div>
        </div>
      )}

      {!unlocked && hidden.length > 0 && (
        <div className="mt-10 rounded-2xl border border-indigo-200 bg-indigo-50/80 p-6 dark:border-indigo-900 dark:bg-indigo-950/30">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
              +{hidden.length}
            </span>
            <div>
              <h3 className="text-lg font-semibold">
                {hidden.length} autre{hidden.length > 1 ? "s pistes" : " piste"}{" "}
                identifiée{hidden.length > 1 ? "s" : ""} dans ton profil
              </h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Ton analyse complète inclut {matches.length} métiers classés par
                adéquation, avec pour chacun l'explication personnalisée de l'IA
                et les premières étapes concrètes.
              </p>
            </div>
          </div>

          {/* Capture email inline si l'utilisateur avait skipé */}
          {needsEmailForPayment && (
            <div className="mt-4">
              <InlineEmailCapture
                sessionId={session.sessionId}
                onCaptured={onEmailCapturedForPayment}
                onCancel={() => setNeedsEmailForPayment(false)}
              />
            </div>
          )}

          {!needsEmailForPayment && (
            <>
              <p className="mt-4 text-sm text-slate-700 dark:text-slate-300">
                {stripeOn
                  ? "Paiement unique · Accès immédiat · Aucun abonnement."
                  : "Côté serveur, renseigne STRIPE_SECRET_KEY et STRIPE_PRICE_FULL_REPORT pour activer le paiement."}
              </p>
              <button
                type="button"
                disabled={checkoutLoading}
                onClick={() => void onCheckout()}
                className="mt-4 rounded-full bg-indigo-600 px-6 py-3 text-sm font-medium text-white shadow hover:bg-indigo-500 disabled:opacity-60"
              >
                {checkoutLoading
                  ? "Redirection…"
                  : `Voir les ${hidden.length} autres métiers →`}
              </button>
            </>
          )}
        </div>
      )}

      {verifyMsg && (
        <p className="mt-6 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-100">
          {verifyMsg}
        </p>
      )}

      <ul className="mt-10 flex flex-col gap-6">
        {visible.map((m, i) => {
          const rating = session.ratings?.[m.job.slug];

          // Couleur de la carte selon la note — transition douce pour ne pas choquer
          const cardClass =
            rating === "like"
              ? "rounded-2xl border border-emerald-300 bg-emerald-50/70 p-6 shadow-sm transition-colors duration-500 dark:border-emerald-800 dark:bg-emerald-950/30"
              : rating === "dislike"
                ? "rounded-2xl border border-rose-300 bg-rose-50/70 p-6 shadow-sm transition-colors duration-500 dark:border-rose-900 dark:bg-rose-950/20"
                : rating === "neutral"
                  ? "rounded-2xl border border-slate-300 bg-slate-100/80 p-6 shadow-sm transition-colors duration-500 dark:border-slate-600 dark:bg-slate-800/60"
                  : "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-colors duration-500 dark:border-slate-800 dark:bg-slate-900";

          return (
          <li
            key={m.job.slug}
            className={cardClass}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                #{i + 1} · {m.scorePercent}% d'adéquation
              </span>
              <Link
                href={`/metiers/${m.job.slug}?sessionId=${session.sessionId}&rank=${i + 1}`}
                className="text-sm font-medium text-slate-900 underline-offset-2 hover:underline dark:text-white"
              >
                Fiche métier →
              </Link>
            </div>
            <h2 className="mt-2 text-xl font-semibold">{m.job.title}</h2>
            <p className="mt-1 text-slate-600 dark:text-slate-300">
              {m.job.tagline}
            </p>
            {m.rationale && (
              <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 dark:border-indigo-900/50 dark:bg-indigo-950/30">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500 dark:text-indigo-400">
                  Pourquoi ce métier te correspond
                </p>
                <p className="mt-1 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  {m.rationale}
                </p>
              </div>
            )}

            {/* Boutons de notation — gratuit, sur toutes les cartes visibles */}
            <JobRatingButtons
              sessionId={session.sessionId}
              jobSlug={m.job.slug}
              currentRating={session.ratings?.[m.job.slug]}
              onRated={(rating) => onRated(m.job.slug, rating)}
            />
          </li>
          );
        })}

        {!unlocked &&
          hidden.map((m) => (
            <li
              key={m.job.slug}
              className="relative overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-6 dark:border-slate-600 dark:bg-slate-900/40"
            >
              <div className="blur-sm select-none">
                <p className="text-sm text-slate-500">Métier masqué</p>
                <h2 className="mt-2 text-xl font-semibold">{m.job.title}</h2>
              </div>
              <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[2px] dark:bg-slate-950/50">
                <span className="rounded-full bg-slate-900/80 px-4 py-2 text-sm font-medium text-white dark:bg-white/90 dark:text-slate-900">
                  Rapport complet
                </span>
              </div>
            </li>
          ))}
      </ul>

      {/* ── Bloc "Affiner mes résultats" (Phase 4) ─────────────────────── */}
      {/* Affiché quand au moins 1 métier a été noté */}
      {Object.keys(session.ratings ?? {}).length > 0 && !session.refinedMatches && (
        <div className="mt-10 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50/50 p-6 dark:border-indigo-900 dark:from-indigo-950/30 dark:to-purple-950/20">
          <h3 className="text-lg font-semibold">
            🎯 Affine tes résultats
          </h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Tu as noté {Object.keys(session.ratings).length} métier
            {Object.keys(session.ratings).length > 1 ? "s" : ""}. On peut
            maintenant trouver <strong>5 nouvelles pistes</strong> basées
            précisément sur ce qui t&apos;a plu — et ce qui ne t&apos;a pas
            plu.
          </p>
          {unlocked ? (
            <button
              type="button"
              disabled={refining}
              onClick={() => void onRefine()}
              className="mt-4 rounded-full bg-indigo-600 px-6 py-3 text-sm font-medium text-white shadow transition hover:bg-indigo-500 disabled:opacity-60"
            >
              {refining ? "Analyse en cours…" : "Voir mes résultats affinés →"}
            </button>
          ) : (
            <>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                Cette fonctionnalité est incluse dans le rapport complet.
              </p>
              <button
                type="button"
                disabled={checkoutLoading}
                onClick={() => void onCheckout()}
                className="mt-3 rounded-full bg-indigo-600 px-6 py-3 text-sm font-medium text-white shadow hover:bg-indigo-500 disabled:opacity-60"
              >
                {checkoutLoading ? "Redirection…" : "Débloquer le rapport complet →"}
              </button>
            </>
          )}
        </div>
      )}

      {/* ── 2e passe — résultats affinés ─────────────────────────────── */}
      {session.refinedMatches && session.refinedMatches.length > 0 && (
        <RefinedResults
          matches={session.refinedMatches}
          insight={session.refineInsight ?? ""}
          sessionId={session.sessionId}
        />
      )}

      {unlocked && (
        <p className="mt-8 text-center text-sm text-slate-500">
          Merci — tout le classement est visible sur cet appareil (stockage
          local).
        </p>
      )}
    </div>
  );
}
