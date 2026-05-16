"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiGet } from "@/lib/api";
import { isUnlocked } from "@/lib/storage";

// ── Types (miroir de ai.service.ts) ──────────────────────────────────────────

type StudentFormation = {
  name: string;
  duration: string;
  cost: string;
};

type CpfFormation = {
  name: string;
  duration: string;
  cpfEligible: boolean;
};

type ActionPlanStudent = {
  track: "student";
  formations: StudentFormation[];
  typicalPath: string;
  thisWeek: string[];
};

type ActionPlanProfessional = {
  track: "professional";
  skillsDelta: { already: string[]; missing: string[] };
  cpfFormations: CpfFormation[];
  salaryHint: string;
  timeline: { sixMonths: string; oneYear: string; twoYears: string };
};

type ActionPlan = ActionPlanStudent | ActionPlanProfessional;

type PersonalizedSheetContent = {
  strengths: string;
  watchPoints: string;
  nextSteps: string[];
  dayInLife: string;
  actionPlan?: ActionPlan | null;
};

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="mt-8 animate-pulse space-y-3">
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-9 w-24 rounded-full bg-slate-200 dark:bg-slate-700" />
        ))}
      </div>
      <div className="h-40 rounded-2xl bg-slate-100 dark:bg-slate-800" />
    </div>
  );
}

// ── Onglet Analyse (forces + vigilance) ──────────────────────────────────────

function TabAnalyse({
  strengths,
  watchPoints,
}: {
  strengths: string;
  watchPoints: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
          ✅ Ce qui va te plaire
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {strengths}
        </p>
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-5 dark:border-amber-900 dark:bg-amber-950/30">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
          ⚠️ Points de vigilance
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {watchPoints}
        </p>
      </div>
    </div>
  );
}

// ── Onglet Journée type ───────────────────────────────────────────────────────

function TabJournee({ dayInLife }: { dayInLife: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-700 dark:bg-slate-800/40">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        📅 Une journée dans ta vie
      </p>
      <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        {dayInLife}
      </p>
    </div>
  );
}

// ── Onglet Prochaines étapes ──────────────────────────────────────────────────

function TabEtapes({ nextSteps }: { nextSteps: string[] }) {
  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-5 dark:border-indigo-900 dark:bg-indigo-950/30">
      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
        🎯 Tes prochaines étapes
      </p>
      <ol className="mt-3 space-y-3">
        {nextSteps.map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
              {i + 1}
            </span>
            <span className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {step}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── Onglet Plan d'action ──────────────────────────────────────────────────────

function TabPlan({ plan }: { plan: ActionPlan }) {
  if (plan.track === "student") {
    return (
      <div className="space-y-4">
        {/* Formations */}
        <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-5 dark:border-violet-900 dark:bg-violet-950/30">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
            🎓 Formations accessibles
          </p>
          <ul className="mt-3 space-y-3">
            {plan.formations.map((f, i) => (
              <li key={i} className="flex flex-col gap-1">
                <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                  {f.name}
                </span>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                    ⏱ {f.duration}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    💶 {f.cost}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Parcours type */}
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-5 dark:border-indigo-900 dark:bg-indigo-950/30">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
            🛤️ Parcours type
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {plan.typicalPath}
          </p>
        </div>

        {/* À faire cette semaine */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            ✅ À faire cette semaine
          </p>
          <ol className="mt-3 space-y-2">
            {plan.thisWeek.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <span className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    );
  }

  // professional
  return (
    <div className="space-y-4">
      {/* Delta compétences */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-700 dark:bg-slate-800/40">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          📊 Tes compétences
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              ✅ Ce que tu as déjà
            </p>
            <ul className="space-y-1">
              {plan.skillsDelta.already.map((s, i) => (
                <li key={i} className="text-sm leading-snug text-slate-700 dark:text-slate-300">
                  · {s}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-amber-600 dark:text-amber-400">
              📌 Ce qu&apos;il te manque
            </p>
            <ul className="space-y-1">
              {plan.skillsDelta.missing.map((s, i) => (
                <li key={i} className="text-sm leading-snug text-slate-700 dark:text-slate-300">
                  · {s}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Formations CPF */}
      {plan.cpfFormations.length > 0 && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-5 dark:border-violet-900 dark:bg-violet-950/30">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
            🎓 Formations accessibles
          </p>
          <ul className="mt-3 space-y-3">
            {plan.cpfFormations.map((f, i) => (
              <li key={i} className="flex flex-col gap-1">
                <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                  {f.name}
                </span>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                    ⏱ {f.duration}
                  </span>
                  {f.cpfEligible && (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                      CPF éligible
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Salaire */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-5 dark:border-amber-900 dark:bg-amber-950/30">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
          💶 Salaire de départ réaliste
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {plan.salaryHint}
        </p>
      </div>

      {/* Timeline */}
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-5 dark:border-indigo-900 dark:bg-indigo-950/30">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
          📅 Ta timeline
        </p>
        <div className="mt-3 space-y-3">
          {(
            [
              { label: "6 mois", value: plan.timeline.sixMonths },
              { label: "1 an", value: plan.timeline.oneYear },
              { label: "2 ans", value: plan.timeline.twoYears },
            ] as const
          ).map(({ label, value }) => (
            <div key={label} className="flex gap-3">
              <span className="mt-0.5 shrink-0 rounded-full bg-indigo-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                {label}
              </span>
              <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

type TabId = "analyse" | "journee" | "etapes" | "plan";

export default function PersonalizedSheetSection({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const rankParam = searchParams.get("rank");
  const rank = rankParam ? parseInt(rankParam, 10) : null;

  const [content, setContent] = useState<PersonalizedSheetContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("analyse");

  const unlocked = isUnlocked();
  const canView = !!sessionId && (rank === 1 || unlocked);

  useEffect(() => {
    if (!canView || !sessionId) return;

    setLoading(true);
    setError(null);

    apiGet<{ content: PersonalizedSheetContent | null }>(
      `/v1/jobs/${slug}/sheet?sessionId=${encodeURIComponent(sessionId)}`,
    )
      .then((res) => setContent(res.content))
      .catch(() => setError("Impossible de charger l'analyse personnalisée."))
      .finally(() => setLoading(false));
  }, [slug, sessionId, canView]);

  if (!sessionId) return null;

  if (!canView && rank !== null && rank > 1) {
    return (
      <div className="mt-12 rounded-2xl border border-dashed border-indigo-300 bg-indigo-50/60 p-8 text-center dark:border-indigo-800 dark:bg-indigo-950/20">
        <p className="text-lg font-semibold">Analyse personnalisée disponible</p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Forces, vigilance, journée type, prochaines étapes et plan d&apos;action —
          adaptés spécifiquement à tes réponses.
        </p>
        <a
          href="/resultats"
          className="mt-5 inline-block rounded-full bg-indigo-600 px-6 py-3 text-sm font-medium text-white shadow hover:bg-indigo-500"
        >
          Débloquer le rapport complet →
        </a>
      </div>
    );
  }

  if (loading) return <Skeleton />;
  if (error) return <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">{error}</p>;
  if (!content) return null;

  const tabs: { id: TabId; label: string; show: boolean }[] = [
    { id: "analyse", label: "🔍 Analyse", show: true },
    { id: "journee", label: "📅 Journée type", show: true },
    { id: "etapes", label: "🎯 Étapes", show: true },
    { id: "plan", label: "🗺️ Plan d'action", show: !!content.actionPlan },
  ];

  const visibleTabs = tabs.filter((t) => t.show);

  return (
    <div>
      {/* Barre d'onglets analyse */}
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-slate-800/60">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={[
              "flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Contenu de l'onglet actif */}
      <div className="mt-4">
        {activeTab === "analyse" && (
          <TabAnalyse strengths={content.strengths} watchPoints={content.watchPoints} />
        )}
        {activeTab === "journee" && <TabJournee dayInLife={content.dayInLife} />}
        {activeTab === "etapes" && <TabEtapes nextSteps={content.nextSteps} />}
        {activeTab === "plan" && content.actionPlan && (
          <TabPlan plan={content.actionPlan} />
        )}
      </div>
    </div>
  );
}
