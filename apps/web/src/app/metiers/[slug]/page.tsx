import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Coins } from "lucide-react";
import ThemeToggle from "@/components/theme-toggle";
import JobPageTabs from "./job-page-tabs";
import ScoreRing from "./score-ring";
import SaveButton from "./save-button";

// ISR à la demande : aucune fiche n'est générée au build (generateStaticParams
// renvoie []), chaque métier est rendu au 1er hit puis mis en cache et revalidé
// toutes les heures. Évite ~1584 appels API au build et garde des pages
// statiques cacheables (bon pour le crawl et le TTFB).
export const revalidate = 3600;
export const dynamicParams = true;

export function generateStaticParams(): { slug: string }[] {
  return [];
}

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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://oryam.fr";

async function fetchJob(slug: string): Promise<Job> {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
  const res = await fetch(`${base}/v1/jobs/${slug}`, {
    next: { revalidate: 3600 },
  });
  if (res.status === 404) notFound();
  if (!res.ok) throw new Error("Métier introuvable");
  return res.json() as Promise<Job>;
}

/**
 * SEO par fiche : title/description uniques dérivés du métier ROME.
 * `fetchJob` est mémoïsé par Next (même URL + revalidate) → pas de requête
 * supplémentaire par rapport au rendu de la page.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const job = await fetchJob(slug);

  const title = `${job.title} — fiche métier, missions, salaire et formations`;
  // Description ≤ ~160 caractères pour éviter la troncature SERP.
  const raw = job.summary || job.tagline || `Découvre le métier ${job.title}.`;
  const description = raw.length > 158 ? `${raw.slice(0, 155).trimEnd()}…` : raw;
  const url = `/metiers/${job.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function MetierPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const job = await fetchJob(slug);
  const url = `${SITE_URL}/metiers/${job.slug}`;

  // Données structurées : Occupation (le code ROME sert d'occupationalCategory)
  // + fil d'Ariane. Éligible aux rich results Google.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Occupation",
        name: job.title,
        description: job.summary || job.tagline || undefined,
        occupationalCategory: job.slug,
        skills: job.skills.length > 0 ? job.skills.join(", ") : undefined,
        url,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Accueil", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Métiers", item: `${SITE_URL}/metiers` },
          { "@type": "ListItem", position: 3, name: job.title, item: url },
        ],
      },
    ],
  };

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* Données structurées (JSON-LD). `<` échappe un éventuel "<" dans les
          champs métier pour empêcher toute fermeture prématurée du <script>. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
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
