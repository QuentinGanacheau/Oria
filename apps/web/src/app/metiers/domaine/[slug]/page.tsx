import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import ThemeToggle from "@/components/theme-toggle";

// ISR à la demande : les 14 piliers sont rendus au 1er hit puis mis en cache et
// revalidés toutes les heures. Aucun fetch au build (generateStaticParams []),
// donc un hoquet de l'API ne casse pas le déploiement.
export const revalidate = 3600;
export const dynamicParams = true;

export function generateStaticParams(): { slug: string }[] {
  return [];
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://oryam.fr";

type JobItem = { slug: string; title: string };
type DomainDetail = {
  code: string;
  slug: string;
  label: string;
  intro: string;
  jobs: JobItem[];
};

async function fetchDomain(slug: string): Promise<DomainDetail> {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
  const res = await fetch(`${base}/v1/jobs/domains/${slug}`, {
    next: { revalidate: 3600 },
  });
  if (res.status === 404) notFound();
  if (!res.ok) throw new Error("Domaine introuvable");
  return res.json() as Promise<DomainDetail>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const domain = await fetchDomain(slug);
  const title = `Métiers de « ${domain.label} »`;
  const description =
    domain.intro.length > 158 ? `${domain.intro.slice(0, 155).trimEnd()}…` : domain.intro;
  const url = `/metiers/domaine/${domain.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", url, title: `${title} | Oryam`, description },
  };
}

export default async function DomainPillarPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const domain = await fetchDomain(slug);
  const url = `${SITE_URL}/metiers/domaine/${domain.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Métiers", item: `${SITE_URL}/metiers` },
      { "@type": "ListItem", position: 3, name: domain.label, item: url },
    ],
  };

  return (
    <div className="min-h-screen bg-paper text-ink">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      {/* ── Topbar ───────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[920px] items-center justify-between px-6">
          <Link
            href="/metiers"
            className="inline-flex items-center gap-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-75"
          >
            <ArrowLeft className="size-4" /> Tous les domaines
          </Link>
          <ThemeToggle />
        </div>
      </div>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <header className="border-b border-line">
        <div className="mx-auto max-w-[920px] px-6 py-12">
          {/* Fil d'Ariane */}
          <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-[13px] text-muted">
            <Link href="/" className="transition-colors hover:text-accent-ink">Accueil</Link>
            <ChevronRight className="size-3.5" />
            <Link href="/metiers" className="transition-colors hover:text-accent-ink">Métiers</Link>
            <ChevronRight className="size-3.5" />
            <span className="text-ink-soft">{domain.label}</span>
          </nav>

          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-accent-ink">
            Domaine
          </p>
          <h1 className="mt-3 font-serif text-[clamp(30px,4.6vw,50px)] leading-[1.06] tracking-tight">
            Métiers de « {domain.label} »
          </h1>
          <p className="mt-4 max-w-[64ch] text-lg text-ink-soft">{domain.intro}</p>
          <p className="mt-5 text-sm text-muted">
            {domain.jobs.length.toLocaleString("fr-FR")} métiers dans ce domaine.{" "}
            <Link href="/questionnaire" className="font-semibold text-accent-ink underline underline-offset-2">
              Trouve ceux qui te ressemblent
            </Link>
            .
          </p>
        </div>
      </header>

      {/* ── Liste des métiers ────────────────────────────────────────── */}
      <main className="mx-auto max-w-[920px] px-6 py-12">
        <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          {domain.jobs.map((job) => (
            <li key={job.slug}>
              <Link
                href={`/metiers/${job.slug}`}
                className="block rounded-lg py-1.5 text-[15px] text-ink-soft transition-colors hover:text-accent-ink"
              >
                {job.title}
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
