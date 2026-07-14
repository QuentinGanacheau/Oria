import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ThemeToggle from "@/components/theme-toggle";

// Index statique revalidé toutes les heures : la liste ROME bouge rarement.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Tous les métiers — annuaire des fiches métier",
  description:
    "Explore l'ensemble des fiches métier Oryam : missions, salaire, formations et débouchés pour plus de 1500 métiers, du lycée à la reconversion.",
  alternates: { canonical: "/metiers" },
  openGraph: {
    type: "website",
    url: "/metiers",
    title: "Tous les métiers — annuaire des fiches métier | Oryam",
    description:
      "Explore l'ensemble des fiches métier Oryam : missions, salaire, formations et débouchés.",
  },
};

type JobListItem = { slug: string; title: string; tagline: string };

async function fetchJobs(): Promise<JobListItem[]> {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
  const res = await fetch(`${base}/v1/jobs`, { next: { revalidate } });
  if (!res.ok) throw new Error("Liste des métiers indisponible");
  return res.json() as Promise<JobListItem[]>;
}

/**
 * Normalise une initiale pour le regroupement A–Z : majuscule sans accent.
 * Tout ce qui n'est pas une lettre A–Z (chiffres, symboles) tombe dans « # ».
 */
function initialOf(title: string): string {
  const first = title
    .trim()
    .charAt(0)
    .normalize("NFD")
    .replace(/\p{M}/gu, "") // retire les diacritiques (É → E)
    .toUpperCase();
  return /[A-Z]/.test(first) ? first : "#";
}

export default async function MetiersIndexPage() {
  const jobs = await fetchJobs();

  // Regroupement par initiale, tri des groupes et des métiers (locale fr).
  const groups = new Map<string, JobListItem[]>();
  for (const job of jobs) {
    const letter = initialOf(job.title);
    (groups.get(letter) ?? groups.set(letter, []).get(letter)!).push(job);
  }
  const letters = [...groups.keys()].sort((a, b) => a.localeCompare(b, "fr"));
  for (const letter of letters) {
    groups.get(letter)!.sort((a, b) => a.title.localeCompare(b.title, "fr"));
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* ── Topbar ───────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[920px] items-center justify-between px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-75"
          >
            <ArrowLeft className="size-4" /> Accueil
          </Link>
          <ThemeToggle />
        </div>
      </div>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <header className="border-b border-line">
        <div className="mx-auto max-w-[920px] px-6 py-12">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-ink">
            Annuaire des métiers
          </p>
          <h1 className="mt-3.5 font-serif text-[clamp(34px,5.2vw,56px)] leading-[1.05] tracking-tight">
            Tous les métiers
          </h1>
          <p className="mt-3 max-w-[62ch] text-lg text-ink-soft">
            {jobs.length.toLocaleString("fr-FR")} fiches métier : missions, salaire,
            formations et débouchés. Pour trouver celles qui te ressemblent,{" "}
            <Link href="/questionnaire" className="font-semibold text-accent-ink underline underline-offset-2">
              fais le test en 20 minutes
            </Link>
            .
          </p>

          {/* Navigation A–Z */}
          <nav
            aria-label="Navigation par lettre"
            className="mt-6 flex flex-wrap gap-1.5"
          >
            {letters.map((letter) => (
              <a
                key={letter}
                href={`#lettre-${letter}`}
                className="grid size-9 place-items-center rounded-lg border border-line bg-surface text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-soft"
              >
                {letter}
              </a>
            ))}
          </nav>
        </div>
      </header>

      {/* ── Liste groupée ────────────────────────────────────────────── */}
      <main className="mx-auto max-w-[920px] px-6 py-12">
        {letters.map((letter) => (
          <section key={letter} id={`lettre-${letter}`} className="mb-12 scroll-mt-20 last:mb-0">
            <h2 className="mb-4 font-serif text-3xl text-accent">{letter}</h2>
            <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
              {groups.get(letter)!.map((job) => (
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
          </section>
        ))}
      </main>
    </div>
  );
}
