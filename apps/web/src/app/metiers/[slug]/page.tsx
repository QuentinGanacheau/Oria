import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Coins } from "lucide-react";
import ThemeToggle from "@/components/theme-toggle";
import JobPageTabs from "./job-page-tabs";
import ScoreRing from "./score-ring";
import SaveButton from "./save-button";

export const dynamic = "force-dynamic";

type RecruitmentLevel = "high" | "medium" | "low" | null;

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
  recruitmentLevel: RecruitmentLevel;
  offerCount: number | null;
};

/**
 * Métadonnées d'affichage du badge de recrutement.
 * Couleur + libellé reflètent le niveau *relatif* aux autres métiers (volume
 * d'offres France Travail). Renvoie null si la donnée est indisponible.
 */
function recruitmentMeta(level: RecruitmentLevel) {
  switch (level) {
    case "high":
      return { label: "Recrute beaucoup", dot: "bg-emerald-500", text: "text-emerald-700" };
    case "medium":
      return { label: "Recrute modérément", dot: "bg-amber-500", text: "text-amber-700" };
    case "low":
      return { label: "Recrute peu", dot: "bg-rose-500", text: "text-rose-700" };
    default:
      return null;
  }
}

async function fetchJob(slug: string): Promise<Job> {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
  const res = await fetch(`${base}/v1/jobs/${slug}`, {
    next: { revalidate: 3600 },
  });
  if (res.status === 404) notFound();
  if (!res.ok) throw new Error("Métier introuvable");
  return res.json() as Promise<Job>;
}

export default async function MetierPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const job = await fetchJob(slug);

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* ── Topbar ───────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[920px] items-center justify-between px-6">
          <Link
            href="/resultats"
            className="inline-flex items-center gap-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-75"
          >
            <ArrowLeft className="size-4" /> Retour aux résultats
          </Link>
          <div className="flex items-center gap-3.5">
            <SaveButton slug={job.slug} />
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <header className="border-b border-line">
        <div className="mx-auto grid max-w-[920px] grid-cols-1 items-center gap-8 px-6 py-12 sm:grid-cols-[1fr_auto]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-ink">
              Fiche métier
            </p>
            <h1 className="mt-3.5 font-serif text-[clamp(34px,5.2vw,56px)] leading-[1.05] tracking-tight">
              {job.title}
            </h1>
            {job.tagline && (
              <p className="mt-2.5 text-lg text-ink-soft">{job.tagline}</p>
            )}
            <div className="mt-5 flex flex-wrap gap-2.5">
              {(() => {
                const meta = recruitmentMeta(job.recruitmentLevel);
                if (!meta) return null;
                return (
                  <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-[13.5px] text-ink-soft">
                    <span className={`size-2 flex-none rounded-full ${meta.dot}`} />
                    <span className={`font-semibold ${meta.text}`}>{meta.label}</span>
                    {job.offerCount != null && job.offerCount > 0 && (
                      <span className="text-muted">
                        · {job.offerCount.toLocaleString("fr-FR")} offres en ligne
                      </span>
                    )}
                  </span>
                );
              })()}
              {job.salaryRangeHint && (
                <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-[13.5px] text-ink-soft">
                  <Coins className="size-[15px] flex-none text-accent-ink" strokeWidth={1.8} />
                  {job.salaryRangeHint}
                </span>
              )}
              {job.workContext && (
                <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-[13.5px] text-ink-soft">
                  <Building2 className="size-[15px] flex-none text-accent-ink" strokeWidth={1.8} />
                  {job.workContext}
                </span>
              )}
            </div>
          </div>
          <div className="-order-1 sm:order-none">
            <ScoreRing slug={job.slug} />
          </div>
        </div>
      </header>

      <JobPageTabs job={job} />
    </div>
  );
}
