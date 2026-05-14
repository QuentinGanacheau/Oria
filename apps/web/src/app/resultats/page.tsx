import { Suspense } from "react";
import ResultatsClient from "./resultats-client";

export default function ResultatsPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Suspense
        fallback={
          <p className="px-6 py-20 text-center text-slate-500">Chargement des résultats…</p>
        }
      >
        <ResultatsClient />
      </Suspense>
    </div>
  );
}
