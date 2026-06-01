"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Sparkles, Zap } from "lucide-react";
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
    <div className="rounded-3xl border border-line bg-surface p-7 shadow-[0_30px_60px_-38px_rgba(20,40,25,.28)] sm:p-12">
      {/* Eyebrow + archétype */}
      <div className={reveal(1)}>
        <p className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-accent-ink">
          <Sparkles className="size-4" strokeWidth={1.7} /> Ton portrait
        </p>
        <h1 className="mt-3 text-center font-serif text-[clamp(30px,4vw,44px)] leading-tight tracking-tight">
          {portrait.archetype}
        </h1>
      </div>

      {/* Summary */}
      <p
        className={`mt-6 text-center text-base leading-relaxed text-ink-soft sm:text-lg ${reveal(2)}`}
      >
        {portrait.summary}
      </p>

      {/* Forces — chips */}
      <div className={`mt-8 ${reveal(3)}`}>
        <p className="text-center text-xs font-semibold uppercase tracking-wider text-muted">
          Tes forces naturelles
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2.5">
          {portrait.strengths.map((force, i) => (
            <span
              key={i}
              className="rounded-full bg-accent-soft px-4 py-2 text-sm font-medium text-accent-ink"
            >
              {force}
            </span>
          ))}
        </div>
      </div>

      {/* Thrives + Drains : deux cartes côte à côte */}
      <div className={`mt-8 grid gap-4 sm:grid-cols-2 ${reveal(4)}`}>
        <div className="rounded-2xl border border-accent/30 bg-accent-soft p-5">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-accent-ink">
            <Zap className="size-4" strokeWidth={1.8} /> Ce qui te fait vibrer
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            {portrait.thrives}
          </p>
        </div>
        <div className="rounded-2xl border border-warn/35 bg-warn/10 p-5">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-warn">
            <AlertTriangle className="size-4" strokeWidth={1.8} /> Ce qui te viderait
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            {portrait.drains}
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className={`mt-10 text-center ${reveal(5)}`}>
        <button
          type="button"
          onClick={onComplete}
          className="group inline-flex items-center gap-2 rounded-full bg-ink px-7 py-3.5 text-base font-semibold text-paper transition hover:bg-accent hover:text-white"
        >
          Voir mes métiers compatibles
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}
