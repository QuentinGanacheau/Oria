"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiGet } from "@/lib/api";
import { isUnlocked } from "@/lib/storage";

type PersonalizedSheetContent = {
  strengths: string;
  watchPoints: string;
  nextSteps: string[];
  dayInLife: string;
};

function Skeleton() {
  return (
    <div className="mt-12 animate-pulse space-y-4">
      <div className="h-4 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="h-24 rounded-xl bg-slate-100 dark:bg-slate-800" />
      <div className="h-24 rounded-xl bg-slate-100 dark:bg-slate-800" />
      <div className="h-20 rounded-xl bg-slate-100 dark:bg-slate-800" />
      <div className="h-20 rounded-xl bg-slate-100 dark:bg-slate-800" />
    </div>
  );
}

export default function PersonalizedSheetSection({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const rankParam = searchParams.get("rank");
  const rank = rankParam ? parseInt(rankParam, 10) : null;

  const [content, setContent] = useState<PersonalizedSheetContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unlocked = isUnlocked();
  const canView = !!sessionId && (rank === 1 || unlocked);

  useEffect(() => {
    if (!canView || !sessionId) return;

    setLoading(true);
    setError(null);

    apiGet<{ content: PersonalizedSheetContent | null }>(
      `/v1/jobs/${slug}/sheet?sessionId=${encodeURIComponent(sessionId)}`,
    )
      .then((res) => {
        setContent(res.content);
      })
      .catch(() => {
        setError("Impossible de charger l'analyse personnalisée.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [slug, sessionId, canView]);

  // Pas de contexte de session — visite directe sans questionnaire
  if (!sessionId) return null;

  // Non débloqué + rang > 1 → prompt paywall inline
  if (!canView && rank !== null && rank > 1) {
    return (
      <div className="mt-12 rounded-2xl border border-dashed border-indigo-300 bg-indigo-50/60 p-8 text-center dark:border-indigo-800 dark:bg-indigo-950/20">
        <p className="text-lg font-semibold">Analyse personnalisée disponible</p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Cette fiche contient tes points forts, les points de vigilance, 3 étapes
          concrètes et une journée type — adaptés spécifiquement à tes réponses.
        </p>
        <a
          href="/resultats"
          className="mt-5 inline-block rounded-full bg-indigo-600 px-6 py-3 text-sm font-medium text-white shadow hover:bg-indigo-500"
        >
          Débloquer le rapport complet →
        </a>
      </div>
    );
  }

  if (loading) return <Skeleton />;

  if (error) {
    return (
      <p className="mt-12 text-sm text-slate-500 dark:text-slate-400">{error}</p>
    );
  }

  // L'IA n'était pas disponible ou le match n'existe pas pour cette session
  if (!content) return null;

  return (
    <section className="mt-12 border-t border-slate-200 pt-10 dark:border-slate-800">
      <h2 className="text-xl font-semibold tracking-tight">
        Ton analyse personnalisée
      </h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Générée par l&apos;IA à partir de tes réponses au questionnaire.
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        {/* Points forts */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            ✅ Ce qui va te plaire
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {content.strengths}
          </p>
        </div>

        {/* Points de vigilance */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-5 dark:border-amber-900 dark:bg-amber-950/30">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            ⚠️ Points de vigilance
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {content.watchPoints}
          </p>
        </div>

        {/* Prochaines étapes */}
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-5 dark:border-indigo-900 dark:bg-indigo-950/30 sm:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
            🎯 Tes prochaines étapes
          </p>
          <ol className="mt-2 list-decimal pl-5 space-y-1">
            {content.nextSteps.map((step, i) => (
              <li key={i} className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {step}
              </li>
            ))}
          </ol>
        </div>

        {/* Journée type */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-700 dark:bg-slate-800/40 sm:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            📅 Une journée dans ta vie
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {content.dayInLife}
          </p>
        </div>
      </div>
    </section>
  );
}
