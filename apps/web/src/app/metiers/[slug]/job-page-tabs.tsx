"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { isUnlocked } from "@/lib/storage";
import PersonalizedSheetSection from "./personalized-sheet";

type Job = {
  slug: string;
  title: string;
  tagline: string;
  summary: string;
  missions: string[];
  skills: string[];
  formations: string[];
  salaryRangeHint: string;
  workContext: string;
};

type TabId = "analyse" | "metier";

function StaticJobContent({
  job,
  onGoToAnalyse,
}: {
  job: Job;
  onGoToAnalyse?: () => void;
}) {
  return (
    <div className="space-y-10">
      {job.summary && (
        <section>
          <h2 className="text-lg font-semibold">En bref</h2>
          <p className="mt-2 whitespace-pre-line leading-relaxed text-slate-700 dark:text-slate-300">
            {job.summary}
          </p>
          {onGoToAnalyse && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={onGoToAnalyse}
                className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 transition-colors"
              >
                👤 Voir mon analyse personnalisée →
              </button>
            </div>
          )}
        </section>
      )}

      {job.missions.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Missions typiques</h2>
          <ul className="mt-3 list-inside list-disc space-y-2 text-slate-700 dark:text-slate-300">
            {job.missions.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </section>
      )}

      {job.skills.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Compétences souvent attendues</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {job.skills.map((s) => (
              <li
                key={s}
                className="rounded-full bg-slate-100 px-3 py-1 text-sm dark:bg-slate-800"
              >
                {s}
              </li>
            ))}
          </ul>
        </section>
      )}

      {job.formations.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Formations possibles</h2>
          <ul className="mt-3 list-inside list-disc space-y-2 text-slate-700 dark:text-slate-300">
            {job.formations.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </section>
      )}

      {(job.salaryRangeHint || job.workContext) && (
        <section className="grid gap-6 sm:grid-cols-2">
          {job.salaryRangeHint && (
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Rémunération
              </h3>
              <p className="mt-2 text-sm leading-relaxed">{job.salaryRangeHint}</p>
            </div>
          )}
          {job.workContext && (
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Contexte de travail
              </h3>
              <p className="mt-2 text-sm leading-relaxed">{job.workContext}</p>
            </div>
          )}
        </section>
      )}

      {onGoToAnalyse && (
        <div className="flex justify-center border-t border-slate-200 pt-8 dark:border-slate-800">
          <button
            type="button"
            onClick={onGoToAnalyse}
            className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-500"
          >
            👤 Voir mon analyse personnalisée →
          </button>
        </div>
      )}
    </div>
  );
}

function JobPageTabsInner({ job }: { job: Job }) {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const rank = searchParams.get("rank") ? parseInt(searchParams.get("rank")!, 10) : null;
  const unlocked = isUnlocked();

  // Contenu verrouillé = rank > 1 et pas payé → on ouvre sur "Mon analyse"
  // pour que le paywall soit visible dès l'arrivée sur la page.
  const isLocked = !!sessionId && !unlocked && rank !== null && rank > 1;

  // Sans session, on affiche le contenu statique directement sans onglets
  const hasTabs = !!sessionId;
  const [activeTab, setActiveTab] = useState<TabId>(isLocked ? "analyse" : "metier");

  if (!hasTabs) {
    return (
      <div className="mt-10">
        <StaticJobContent job={job} />
      </div>
    );
  }

  const tabs: { id: TabId; label: string; locked: boolean }[] = [
    { id: "metier", label: "📋 Ce métier", locked: false },
    { id: "analyse", label: isLocked ? "🔒 Mon analyse" : "👤 Mon analyse", locked: isLocked },
  ];

  return (
    <div className="mt-8">
      {/* Barre d'onglets principale */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/60">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={[
              "flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? tab.locked
                  ? "bg-white text-amber-700 shadow-sm dark:bg-slate-700 dark:text-amber-400"
                  : "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Contenu */}
      <div className="mt-6">
        {activeTab === "metier" && (
          <StaticJobContent
            job={job}
            onGoToAnalyse={() => setActiveTab("analyse")}
          />
        )}
        {activeTab === "analyse" && (
          <PersonalizedSheetSection slug={job.slug} />
        )}
      </div>
    </div>
  );
}

export default function JobPageTabs({ job }: { job: Job }) {
  return (
    <Suspense
      fallback={
        <div className="mt-8 animate-pulse space-y-4">
          <div className="flex gap-2">
            <div className="h-10 flex-1 rounded-xl bg-slate-100 dark:bg-slate-800" />
            <div className="h-10 flex-1 rounded-xl bg-slate-100 dark:bg-slate-800" />
          </div>
          <div className="h-40 rounded-2xl bg-slate-100 dark:bg-slate-800" />
        </div>
      }
    >
      <JobPageTabsInner job={job} />
    </Suspense>
  );
}
