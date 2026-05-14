"use client";

import { useEffect, useState } from "react";
import type { StoredPortrait } from "@/lib/storage";

/**
 * Écran de portrait — affiché entre la capture email et l'arrivée sur /resultats.
 *
 * C'est le moment "wow" du parcours : l'utilisateur découvre son archétype, ses
 * forces et ce qui le porte. La confiance gagnée ici améliore la perception
 * des métiers recommandés ensuite.
 *
 * Si `portrait` est null (IA indisponible au moment de la génération), on
 * skippe silencieusement vers `onComplete()` — pas de moment de gêne pour
 * l'utilisateur, juste un passage direct aux résultats.
 *
 * Pas d'appel API : le portrait est déjà dans la réponse de /v1/questionnaire/match.
 */

type Props = {
  portrait: StoredPortrait | null;
  /** Déclenché à la fin de l'écran (CTA "Voir mes métiers compatibles"). */
  onComplete: () => void;
};

export default function PortraitScreen({ portrait, onComplete }: Props) {
  // Apparition progressive : chaque bloc révélé avec un léger décalage
  // pour donner du rythme à la lecture (pas tout en même temps).
  const [revealLevel, setRevealLevel] = useState(0);

  useEffect(() => {
    if (!portrait) {
      // Pas de portrait → skip transparent vers les résultats
      onComplete();
      return;
    }

    // Cascade : 0=archétype → 1=summary → 2=strengths → 3=thrives/drains → 4=cta
    const timers = [200, 600, 1000, 1400, 1800].map((delay, i) =>
      setTimeout(() => setRevealLevel(i + 1), delay),
    );
    return () => timers.forEach(clearTimeout);
  }, [portrait, onComplete]);

  // Cas portrait null : on rend rien (le useEffect a déjà déclenché onComplete)
  if (!portrait) return null;

  // Helper visuel — chaque section utilise la même classe d'apparition
  const reveal = (level: number) =>
    `transition-all duration-700 ease-out ${
      revealLevel >= level
        ? "opacity-100 translate-y-0"
        : "opacity-0 translate-y-3"
    }`;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-10">
      {/* Eyebrow + archétype */}
      <div className={reveal(1)}>
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500 dark:text-indigo-400">
          ✨ Ton portrait
        </p>
        <h1 className="mt-3 text-center text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-4xl">
          {portrait.archetype}
        </h1>
      </div>

      {/* Summary */}
      <p
        className={`mt-6 text-center text-base leading-relaxed text-slate-700 dark:text-slate-200 sm:text-lg ${reveal(2)}`}
      >
        {portrait.summary}
      </p>

      {/* Forces — chips */}
      <div className={`mt-8 ${reveal(3)}`}>
        <p className="text-center text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Tes forces naturelles
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {portrait.strengths.map((force, i) => (
            <span
              key={i}
              className="rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200"
            >
              {force}
            </span>
          ))}
        </div>
      </div>

      {/* Thrives + Drains : deux cartes côte à côte */}
      <div className={`mt-8 grid gap-4 sm:grid-cols-2 ${reveal(4)}`}>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            ⚡ Ce qui te fait vibrer
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            {portrait.thrives}
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-5 dark:border-amber-900 dark:bg-amber-950/30">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
            ⚠️ Ce qui te viderait
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            {portrait.drains}
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className={`mt-10 text-center ${reveal(5)}`}>
        <button
          type="button"
          onClick={onComplete}
          className="rounded-full bg-indigo-600 px-7 py-3.5 text-base font-medium text-white shadow-md transition hover:bg-indigo-500"
        >
          Voir mes métiers compatibles →
        </button>
      </div>
    </div>
  );
}
