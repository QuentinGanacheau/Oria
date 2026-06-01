"use client";

import type { StoredPortrait } from "@/lib/storage";

/**
 * Portrait compact — affiché en haut de la page /resultats.
 *
 * Version condensée de PortraitScreen : pas l'écran entier, juste un rappel
 * de l'archétype et des 3 forces. Donne du contexte aux métiers listés en
 * dessous ("voici qui tu es, voici les métiers qui te correspondent").
 *
 * Si le portrait est null (génération IA échouée), on ne rend rien — la page
 * reste fonctionnelle sans cette section.
 */

type Props = {
  portrait: StoredPortrait | null;
};

export default function PortraitCard({ portrait }: Props) {
  if (!portrait) return null;

  return (
    <section className="mt-8 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-6 dark:border-indigo-900 dark:bg-indigo-950/20">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500 dark:text-indigo-400">
        ✨ Ton portrait
      </p>
      <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
        {portrait.archetype}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
        {portrait.summary}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {portrait.strengths.map((force, i) => (
          <span
            key={i}
            className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-medium text-indigo-700 dark:border-indigo-800 dark:bg-slate-900 dark:text-indigo-200"
          >
            {force}
          </span>
        ))}
      </div>
    </section>
  );
}
