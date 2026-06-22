"use client";

import { Coins, Info } from "lucide-react";

/**
 * Carte métier présentationnelle affichée dans le SwipeDeck.
 *
 * Ce composant ne gère AUCUNE logique de geste : il se contente d'afficher
 * le contenu. Le drag, les overlays J'aime/Passe et l'empilement sont gérés par
 * le SwipeDeck qui enveloppe cette carte dans un <motion.div>.
 *
 * Réutilisable tel quel pour les vraies données (le type est un sous-ensemble
 * de StoredSession['matches'][number]).
 */

export type SwipeCardData = {
  slug: string;
  title: string;
  tagline: string;
  /** Score d'adéquation 0-100. */
  scorePercent: number;
  /** Description courte du métier ("En bref") — affiché sur mobile et desktop. */
  summary?: string | null;
  /** Explication IA. Null/absent si indisponible. */
  rationale?: string | null;
  /** Champs détaillés — surtout affichés sur desktop (plus d'espace). */
  missions?: string[];
  skills?: string[];
  salaryRangeHint?: string;
};

type Props = {
  data: SwipeCardData;
  /** Rang affiché (#1, #2…) — purement décoratif. */
  rank: number;
  /** Ouvre la fiche métier complète (navigation hors du deck). */
  onOpenSheet?: (slug: string) => void;
};

export default function SwipeCard({ data, rank, onOpenSheet }: Props) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[24px] border border-line bg-surface shadow-[0_30px_60px_-32px_rgba(20,40,25,.34)]">
      {/* Bandeau score — dégradé vert, repère visuel fort en haut de carte */}
      <div className="flex flex-none items-center justify-between gap-3 bg-gradient-to-r from-accent-ink to-accent px-6 py-[18px] text-white">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 text-[13px] font-semibold tracking-wide opacity-90">
            Piste #{rank}
          </span>
          <span className="truncate text-[13px] font-semibold">{data.title}</span>
        </span>
        <span className="shrink-0 rounded-full bg-white/20 px-3 py-1.5 text-[13px] font-semibold tabular-nums backdrop-blur-sm">
          {data.scorePercent}% d&apos;adéquation
        </span>
      </div>

      {/* Corps — touch-pan-y pour laisser les swipes horizontaux remonter à
          la motion.div parente sur mobile (sinon overflow-y-auto capture les
          touches et seul le bandeau du haut reste glissable). Le scroll
          vertical n'est activé qu'à partir de md (où la carte est plus haute). */}
      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden px-[26px] py-6 md:overflow-y-auto"
        style={{ touchAction: "pan-y" }}
      >
        <h2 className="font-serif text-[30px] leading-tight tracking-tight">
          {data.title}
        </h2>
        <p className="mt-2 text-base text-ink-soft">{data.tagline}</p>

        {data.summary && (
          <p className="mt-4 text-[14.5px] leading-relaxed text-muted">
            {data.summary}
          </p>
        )}

        {data.rationale && (
          <div className="mt-5 hidden md:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-ink">
              Pourquoi ce métier te correspond
            </p>
            <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">
              {data.rationale}
            </p>
          </div>
        )}

        {/* Détails enrichis — visibles surtout sur grand écran (md+) */}
        {(data.missions?.length ?? 0) + (data.skills?.length ?? 0) > 0 && (
          <div className="hidden flex-col gap-5 md:flex">
            {data.missions && data.missions.length > 0 && (
              <div className="mt-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-ink">
                  Missions clés
                </p>
                <ul className="mt-2.5 flex flex-col gap-1.5">
                  {data.missions.slice(0, 3).map((m) => (
                    <li key={m} className="flex gap-2.5 text-[14.5px] text-ink-soft">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {data.skills && data.skills.length > 0 && (
              <div className="mt-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-ink">
                  Compétences
                </p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {data.skills.slice(0, 5).map((s) => (
                    <span
                      key={s}
                      className="rounded-lg border border-accent/25 bg-accent-soft px-3 py-1.5 text-[12.5px] font-medium leading-snug text-accent-ink [overflow-wrap:anywhere]"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {data.salaryRangeHint && (
          <div className="mt-[18px] flex items-center gap-2.5 text-sm text-ink-soft">
            <Coins className="size-[17px] flex-none text-accent" strokeWidth={1.7} />
            {data.salaryRangeHint}
          </div>
        )}

        {/* Pousse le lien en bas de carte. La carte entière est cliquable
            (géré par le SwipeDeck) ; ce bouton reste comme indice visuel +
            cible accessible au clavier. stopPropagation évite la double
            navigation (clic bouton + clic carte parente). */}
        <div className="mt-auto pt-5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenSheet?.(data.slug);
            }}
            className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent hover:text-white"
          >
            <Info className="size-[15px]" strokeWidth={1.8} /> Voir la fiche complète
          </button>
        </div>
      </div>
    </div>
  );
}
