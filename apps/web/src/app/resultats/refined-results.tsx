"use client";

import Link from "next/link";
import type { StoredSession } from "@/lib/storage";

/**
 * Section "2e passe — résultats affinés" affichée sur /resultats.
 *
 * Trois états possibles :
 *   1. Données déjà en localStorage (session.refinedMatches non null)
 *      → Affichage direct, 0 appel API
 *   2. Utilisateur a payé mais pas encore généré → bouton "Affiner"
 *      (géré par le parent qui appelle /refine et met à jour la session)
 *   3. Non payé → null (le parent gère le paywall)
 */

type Match = StoredSession["matches"][number];

type Props = {
  matches: Match[];
  insight: string;
  sessionId: string;
};

export default function RefinedResults({ matches, insight, sessionId }: Props) {
  return (
    <section className="mt-14">
      {/* Header */}
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500 dark:text-indigo-400">
          ✨ 2e passe — affinée pour toi
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">
          Nouvelles pistes
        </h2>
        {insight && (
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {insight}
          </p>
        )}
      </div>

      {/* Cartes */}
      <ul className="flex flex-col gap-5">
        {matches.map((m, i) => (
          <li
            key={m.job.slug}
            className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-6 shadow-sm dark:border-indigo-900/40 dark:bg-indigo-950/10"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                Piste #{i + 1} · {m.scorePercent}% de compatibilité
              </span>
              <Link
                href={`/metiers/${m.job.slug}?sessionId=${sessionId}&rank=${i + 10}`}
                className="text-sm font-medium text-slate-900 underline-offset-2 hover:underline dark:text-white"
              >
                Fiche métier →
              </Link>
            </div>
            <h3 className="mt-2 text-xl font-semibold">{m.job.title}</h3>
            <p className="mt-1 text-slate-600 dark:text-slate-300">{m.job.tagline}</p>

            {m.rationale && (
              <div className="mt-4 rounded-xl border border-indigo-100 bg-white/60 px-4 py-3 dark:border-indigo-900/30 dark:bg-slate-900/40">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500 dark:text-indigo-400">
                  Pourquoi ce métier te correspond
                </p>
                <p className="mt-1 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  {m.rationale}
                </p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
