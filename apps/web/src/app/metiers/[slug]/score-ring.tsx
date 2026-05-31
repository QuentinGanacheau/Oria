"use client";

import { useEffect, useState } from "react";
import { loadSession } from "@/lib/storage";

/**
 * Anneau d'adéquation (conic-gradient sur l'accent) affiché dans le hero de la
 * fiche métier. Le score n'est pas dans la donnée serveur du métier : il est
 * propre à l'utilisateur, on le lit donc côté client depuis la session locale
 * (matches initiaux + paquets affinés). Rendu nul si aucun score connu pour ce
 * slug (ex. accès direct à la fiche sans avoir fait le questionnaire).
 */
export default function ScoreRing({ slug }: { slug: string }) {
  const [pct, setPct] = useState<number | null>(null);

  useEffect(() => {
    const s = loadSession();
    if (!s) return;
    const all = [...s.matches, ...(s.batches ?? []).flatMap((b) => b.matches)];
    const match = all.find((m) => m.job.slug === slug);
    if (match) setPct(match.scorePercent);
  }, [slug]);

  if (pct === null) return null;

  return (
    <div
      className="grid size-32 flex-none place-items-center rounded-full"
      style={{ background: `conic-gradient(var(--accent) ${pct}%, var(--line) 0)` }}
    >
      <div className="grid size-[100px] place-items-center rounded-full bg-paper text-center">
        <div>
          <div className="font-serif text-[38px] leading-none text-accent-ink">
            {pct}%
          </div>
          <div className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-muted">
            Adéquation
          </div>
        </div>
      </div>
    </div>
  );
}
