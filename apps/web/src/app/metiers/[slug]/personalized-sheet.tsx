"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Check,
  GraduationCap,
  Lock,
  Map as MapIcon,
  Search,
  Target,
} from "lucide-react";
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

// ── Primitives Forêt ──────────────────────────────────────────────────────────

/** Libellé de bloc (uppercase, lettré, icône). */
function BlockLabel({
  Icon,
  tone = "accent",
  children,
}: {
  Icon: typeof Check;
  tone?: "accent" | "warn" | "muted";
  children: React.ReactNode;
}) {
  const color =
    tone === "warn" ? "text-warn" : tone === "muted" ? "text-muted" : "text-accent-ink";
  return (
    <p className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] ${color}`}>
      <Icon className="size-[18px]" strokeWidth={1.9} />
      {children}
    </p>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="mt-2 animate-pulse space-y-3">
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-9 w-24 rounded-full bg-surface-2" />
        ))}
      </div>
      <div className="h-40 rounded-2xl bg-surface-2" />
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
      <div className="rounded-2xl border border-accent/25 bg-accent-soft p-6">
        <BlockLabel Icon={Check}>Ce qui va te plaire</BlockLabel>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{strengths}</p>
      </div>
      <div className="rounded-2xl border border-warn/35 bg-surface p-6">
        <BlockLabel Icon={AlertTriangle} tone="warn">
          Points de vigilance
        </BlockLabel>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{watchPoints}</p>
      </div>
    </div>
  );
}

// ── Onglet Journée type ───────────────────────────────────────────────────────

function TabJournee({ dayInLife }: { dayInLife: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <BlockLabel Icon={Calendar} tone="muted">
        Une journée dans ta vie
      </BlockLabel>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{dayInLife}</p>
    </div>
  );
}

// ── Onglet Prochaines étapes ──────────────────────────────────────────────────

function NumberedSteps({ steps }: { steps: string[] }) {
  return (
    <div className="flex flex-col gap-2.5">
      {steps.map((step, i) => (
        <div
          key={i}
          className="flex items-start gap-3.5 rounded-[14px] border border-line bg-surface p-4"
        >
          <span className="font-serif text-[26px] leading-none text-accent">{i + 1}</span>
          <span className="text-[15px] leading-relaxed text-ink-soft">{step}</span>
        </div>
      ))}
    </div>
  );
}

function TabEtapes({ nextSteps }: { nextSteps: string[] }) {
  return (
    <div>
      <BlockLabel Icon={Target}>Tes prochaines étapes</BlockLabel>
      <div className="mt-4">
        <NumberedSteps steps={nextSteps} />
      </div>
    </div>
  );
}

// ── Onglet Plan d'action ──────────────────────────────────────────────────────

function MetaChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1 text-xs font-medium text-ink-soft">
      {children}
    </span>
  );
}

function TabPlan({ plan }: { plan: ActionPlan }) {
  if (plan.track === "student") {
    return (
      <div className="space-y-4">
        {/* Formations */}
        <div className="rounded-2xl border border-line bg-surface p-6">
          <BlockLabel Icon={GraduationCap}>Formations accessibles</BlockLabel>
          <ul className="mt-4 space-y-3.5">
            {plan.formations.map((f, i) => (
              <li key={i} className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-ink">{f.name}</span>
                <div className="flex flex-wrap gap-2">
                  <MetaChip>⏱ {f.duration}</MetaChip>
                  <MetaChip>{f.cost}</MetaChip>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Parcours type */}
        <div className="rounded-2xl border border-line bg-surface-2 p-6">
          <BlockLabel Icon={MapIcon} tone="muted">
            Parcours type
          </BlockLabel>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{plan.typicalPath}</p>
        </div>

        {/* À faire cette semaine */}
        <div>
          <BlockLabel Icon={Check}>À faire cette semaine</BlockLabel>
          <div className="mt-4">
            <NumberedSteps steps={plan.thisWeek} />
          </div>
        </div>
      </div>
    );
  }

  // professional
  return (
    <div className="space-y-4">
      {/* Delta compétences */}
      <div className="rounded-2xl border border-line bg-surface p-6">
        <BlockLabel Icon={Target} tone="muted">
          Tes compétences
        </BlockLabel>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-accent-ink">
              <Check className="size-4" strokeWidth={2} /> Ce que tu as déjà
            </p>
            <ul className="space-y-1.5">
              {plan.skillsDelta.already.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm leading-snug text-ink-soft">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-warn">
              <AlertTriangle className="size-4" strokeWidth={2} /> Ce qu&apos;il te manque
            </p>
            <ul className="space-y-1.5">
              {plan.skillsDelta.missing.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm leading-snug text-ink-soft">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-warn" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Formations CPF */}
      {plan.cpfFormations.length > 0 && (
        <div className="rounded-2xl border border-line bg-surface p-6">
          <BlockLabel Icon={GraduationCap}>Formations accessibles</BlockLabel>
          <ul className="mt-4 space-y-3.5">
            {plan.cpfFormations.map((f, i) => (
              <li key={i} className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-ink">{f.name}</span>
                <div className="flex flex-wrap gap-2">
                  <MetaChip>⏱ {f.duration}</MetaChip>
                  {f.cpfEligible && (
                    <span className="inline-flex items-center rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent-ink">
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
      <div className="rounded-2xl border border-line bg-surface-2 p-6">
        <BlockLabel Icon={Calendar} tone="muted">
          Salaire de départ réaliste
        </BlockLabel>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{plan.salaryHint}</p>
      </div>

      {/* Timeline */}
      <div className="rounded-2xl border border-line bg-surface p-6">
        <BlockLabel Icon={MapIcon}>Ta timeline</BlockLabel>
        <div className="mt-4 space-y-3">
          {(
            [
              { label: "6 mois", value: plan.timeline.sixMonths },
              { label: "1 an", value: plan.timeline.oneYear },
              { label: "2 ans", value: plan.timeline.twoYears },
            ] as const
          ).map(({ label, value }) => (
            <div key={label} className="flex gap-3">
              <span className="mt-0.5 shrink-0 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white">
                {label}
              </span>
              <p className="text-sm leading-relaxed text-ink-soft">{value}</p>
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
      <div className="rounded-3xl border border-line bg-surface p-8 text-center shadow-[0_30px_60px_-38px_rgba(20,40,25,.28)]">
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-accent-soft">
          <Lock className="size-6 text-accent-ink" strokeWidth={1.8} />
        </div>
        <p className="mt-4 font-serif text-2xl text-ink">Analyse personnalisée disponible</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
          Ce qui va te plaire, points de vigilance, journée type, prochaines étapes
          et plan d&apos;action — adaptés spécifiquement à tes réponses.
        </p>
        <a
          href="/resultats"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper transition hover:bg-accent hover:text-white"
        >
          Débloquer le rapport complet
          <ArrowRight className="size-4" />
        </a>
      </div>
    );
  }

  if (loading) return <Skeleton />;
  if (error) return <p className="text-sm text-muted">{error}</p>;
  if (!content) return null;

  const tabs: { id: TabId; label: string; Icon: typeof Check; show: boolean }[] = [
    { id: "analyse", label: "Analyse", Icon: Search, show: true },
    { id: "journee", label: "Journée type", Icon: Calendar, show: true },
    { id: "etapes", label: "Étapes", Icon: Target, show: true },
    { id: "plan", label: "Plan d'action", Icon: MapIcon, show: !!content.actionPlan },
  ];

  const visibleTabs = tabs.filter((t) => t.show);

  return (
    <div>
      {/* Barre d'onglets analyse */}
      <div className="flex gap-1 overflow-x-auto rounded-full border border-line bg-surface-2 p-1">
        {visibleTabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={[
                "flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold transition-colors",
                active
                  ? "bg-surface text-ink shadow-sm"
                  : "text-muted hover:text-ink-soft",
              ].join(" ")}
            >
              <tab.Icon className="size-4" strokeWidth={1.8} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Contenu de l'onglet actif */}
      <div className="mt-5">
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
