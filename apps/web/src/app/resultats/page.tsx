import { Suspense } from "react";
import DeckResults from "./deck-results";
import ResultatsClient from "./resultats-client";

/**
 * Bascule entre la vue liste (legacy) et la vue swipe deck (Phase C).
 * Pilotée par NEXT_PUBLIC_DECK_MODE pour pouvoir rollback sans toucher au code.
 * Évalué au build (variable NEXT_PUBLIC_*) → l'app doit être rebuild après
 * un changement de cette variable.
 */
const DECK_MODE = process.env.NEXT_PUBLIC_DECK_MODE === "true";

export default function ResultatsPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Suspense
        fallback={
          <p className="px-6 py-20 text-center text-slate-500">Chargement des résultats…</p>
        }
      >
        {DECK_MODE ? <DeckResults /> : <ResultatsClient />}
      </Suspense>
    </div>
  );
}
