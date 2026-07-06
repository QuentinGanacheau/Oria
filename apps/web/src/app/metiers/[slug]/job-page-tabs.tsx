"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, ClipboardList, GraduationCap, Lock, Sparkles, User } from "lucide-react";
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
  recruitmentLevel: "high" | "medium" | "low" | null;
  offerCount: number | null;
};

type TabId = "analyse" | "metier";

/** En-tête de section numérotée (« 01 En bref »). */
function SectionHead({ num, children }: { num: string; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2.5 text-[13px] font-semibold uppercase tracking-[0.16em] text-accent-ink">
      <span className="font-serif text-[22px] tracking-normal text-accent">{num}</span>
      {children}
    </h2>
  );
}

function StaticJobContent({
  job,
  onGoToAnalyse,
}: {
  job: Job;
  onGoToAnalyse?: () => void;
}) {
  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_290px] lg:items-start">
      {/* ── Colonne principale ──────────────────────────────────────── */}
      <div>
        {job.summary && (
          <section className="mb-11">
            <SectionHead num="01">En bref</SectionHead>
            <p className="mt-4 whitespace-pre-line font-serif text-[24px] leading-[1.35] text-ink">
              {job.summary}
            </p>
          </section>
        )}

        {job.missions.length > 0 && (
          <section className="mb-11">
            <SectionHead num="02">Missions typiques</SectionHead>
            <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {job.missions.map((m) => (
                <li
                  key={m}
                  className="flex items-start gap-3 rounded-[14px] border border-line bg-surface p-4 text-[15px] text-ink-soft"
                >
                  <span className="mt-0.5 grid size-[22px] flex-none place-items-center rounded-[7px] bg-accent-soft">
                    <span className="size-1.5 rounded-full bg-accent" />
                  </span>
                  {m}
                </li>
              ))}
            </ul>
          </section>
        )}

        {job.formations.length > 0 && (
          <section className="mb-11 last:mb-0">
            <SectionHead num="03">Formations possibles</SectionHead>
            <ul className="mt-4 flex flex-col gap-3">
              {job.formations.map((f) => (
                <li key={f} className="flex gap-3 text-[15px] text-ink-soft">
                  <GraduationCap className="mt-0.5 size-[19px] flex-none text-accent" strokeWidth={1.9} />
                  {f}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* ── Sidebar sticky ──────────────────────────────────────────── */}
      <aside className="flex flex-col gap-[18px] lg:sticky lg:top-[88px]">
        <div className="rounded-[18px] border border-line bg-surface p-[22px]">
          {job.skills.length > 0 && (
            <>
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-accent-ink">
                <Sparkles className="size-3.5" strokeWidth={1.9} />
                Compétences clés
              </h3>
              <div className="mt-3.5 flex flex-wrap gap-2">
                {job.skills.map((s) => (
                  <span
                    key={s}
                    className="rounded-lg border border-accent/25 bg-accent-soft px-3 py-1.5 text-[13px] font-medium leading-snug text-accent-ink [overflow-wrap:anywhere]"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </>
          )}

          {(job.salaryRangeHint || job.workContext) && (
            <div className={`flex flex-col gap-3.5 ${job.skills.length > 0 ? "mt-4" : ""}`}>
              {job.salaryRangeHint && (
                <div>
                  <div className="text-[12.5px] text-muted">Salaire débutant</div>
                  <div className="mt-0.5 font-serif text-[26px] leading-tight text-accent-ink">
                    {job.salaryRangeHint}
                  </div>
                </div>
              )}
              {job.workContext && (
                <div>
                  <div className="text-[12.5px] text-muted">Contexte de travail</div>
                  <div className="mt-0.5 text-base font-semibold">{job.workContext}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Encart CTA → bascule sur l'analyse personnalisée (paywall-aware) */}
        {onGoToAnalyse && (
          <div className="rounded-[18px] border border-panel bg-panel p-[22px] text-on-panel">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
              Mon analyse personnalisée
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-on-panel/70">
              Ce qui va te plaire, les points de vigilance et des étapes concrètes —
              adaptés à tes réponses.
            </p>
            <button
              type="button"
              onClick={onGoToAnalyse}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-white hover:text-ink"
            >
              Voir mon analyse
              <ArrowRight className="size-4" />
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

function JobPageTabsInner({ job }: { job: Job }) {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const rank = searchParams.get("rank")
    ? parseInt(searchParams.get("rank")!, 10)
    : null;
  const unlocked = isUnlocked(sessionId);

  // Contenu verrouillé = rank > 1 et pas payé → on ouvre sur "Mon analyse"
  // pour que le paywall soit visible dès l'arrivée sur la page.
  const isLocked = !!sessionId && !unlocked && rank !== null && rank > 1;

  // Sans session, on affiche le contenu statique directement sans onglets
  const hasTabs = !!sessionId;
  const [activeTab, setActiveTab] = useState<TabId>(
    isLocked ? "analyse" : "metier",
  );

  if (!hasTabs) {
    return (
      <div className="mx-auto max-w-[920px] px-6 py-12">
        <StaticJobContent job={job} />
      </div>
    );
  }

  const tabs: { id: TabId; label: string; locked: boolean; Icon: typeof User }[] = [
    { id: "metier", label: "Ce métier", locked: false, Icon: ClipboardList },
    {
      id: "analyse",
      label: "Mon analyse",
      locked: isLocked,
      Icon: isLocked ? Lock : User,
    },
  ];

  return (
    <div className="mx-auto max-w-[920px] px-6 py-10">
      {/* Barre d'onglets — segmented control */}
      <div className="flex gap-1 rounded-full border border-line bg-surface-2 p-1">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={[
                "flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors",
                active
                  ? tab.locked
                    ? "bg-surface text-warn shadow-sm"
                    : "bg-surface text-ink shadow-sm"
                  : "text-muted hover:text-ink-soft",
              ].join(" ")}
            >
              <tab.Icon className="size-4" strokeWidth={1.8} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Contenu */}
      <div className="mt-8">
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
        <div className="mx-auto max-w-[920px] animate-pulse space-y-4 px-6 py-10">
          <div className="flex gap-2">
            <div className="h-11 flex-1 rounded-full bg-surface-2" />
            <div className="h-11 flex-1 rounded-full bg-surface-2" />
          </div>
          <div className="h-40 rounded-2xl bg-surface-2" />
        </div>
      }
    >
      <JobPageTabsInner job={job} />
    </Suspense>
  );
}
