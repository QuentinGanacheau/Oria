import Link from "next/link";
import { notFound } from "next/navigation";
import JobPageTabs from "./job-page-tabs";

export const dynamic = "force-dynamic";

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
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <article className="mx-auto max-w-3xl px-6 py-12">
        <Link
          href="/resultats"
          className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
        >
          ← Retour aux résultats
        </Link>

        <header className="mt-8">
          <p className="text-sm font-medium uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            Fiche métier
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">{job.title}</h1>
          <p className="mt-4 text-xl text-slate-600 dark:text-slate-300">{job.tagline}</p>
        </header>

        <JobPageTabs job={job} />
      </article>
    </div>
  );
}
