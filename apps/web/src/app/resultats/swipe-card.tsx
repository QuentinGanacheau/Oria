"use client";

/**
 * Carte métier présentationnelle affichée dans le SwipeDeck.
 *
 * Ce composant ne gère AUCUNE logique de geste : il se contente d'afficher
 * le contenu. Le drag, les overlays LIKE/NOPE et l'empilement sont gérés par
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
    <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
      {/* Bandeau score — repère visuel fort en haut de carte */}
      <div className="flex items-center justify-between bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-3 text-white">
        <span className="text-sm font-medium opacity-90">Piste #{rank}</span>
        <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-bold tabular-nums">
          {data.scorePercent}% d&apos;adéquation
        </span>
      </div>

      {/* Corps — défile si le contenu desktop dépasse la hauteur de carte */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 py-5">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl dark:text-white">
          {data.title}
        </h2>
        <p className="text-slate-600 dark:text-slate-300">{data.tagline}</p>

        {data.rationale && (
          <div className="mt-1 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 dark:border-indigo-900/50 dark:bg-indigo-950/30">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500 dark:text-indigo-400">
              Pourquoi ce métier te correspond
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {data.rationale}
            </p>
          </div>
        )}

        {/* Détails enrichis — visibles surtout sur grand écran (md+) */}
        {(data.missions?.length ?? 0) + (data.skills?.length ?? 0) > 0 && (
          <div className="hidden flex-col gap-4 md:flex">
            {data.missions && data.missions.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Missions clés
                </p>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {data.missions.slice(0, 3).map((m) => (
                    <li
                      key={m}
                      className="flex gap-2 text-sm text-slate-600 dark:text-slate-300"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {data.skills && data.skills.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Compétences
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {data.skills.slice(0, 5).map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
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
          <p className="text-sm text-slate-500 dark:text-slate-400">
            💰 {data.salaryRangeHint}
          </p>
        )}

        {/* Pousse le lien en bas de carte */}
        <div className="mt-auto pt-2">
          <button
            type="button"
            onClick={() => onOpenSheet?.(data.slug)}
            className="text-sm font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-400"
          >
            ℹ Voir la fiche complète
          </button>
        </div>
      </div>
    </div>
  );
}
