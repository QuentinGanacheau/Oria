import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import PersonalizedSheetSection from "./personalized-sheet";

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

        {job.summary && (
          <section className="mt-10">
            <h2 className="text-lg font-semibold">En bref</h2>
            <p className="mt-2 leading-relaxed text-slate-700 whitespace-pre-line dark:text-slate-300">
              {job.summary}
            </p>
          </section>
        )}

        {job.missions.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-semibold">Missions typiques</h2>
            <ul className="mt-3 list-inside list-disc space-y-2 text-slate-700 dark:text-slate-300">
              {job.missions.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </section>
        )}

        {job.skills.length > 0 && (
          <section className="mt-10">
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
          <section className="mt-10">
            <h2 className="text-lg font-semibold">Formations possibles</h2>
            <ul className="mt-3 list-inside list-disc space-y-2 text-slate-700 dark:text-slate-300">
              {job.formations.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </section>
        )}

        {(job.salaryRangeHint || job.workContext) && (
          <section className="mt-10 grid gap-6 sm:grid-cols-2">
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

        <Suspense>
          <PersonalizedSheetSection slug={slug} />
        </Suspense>
      </article>
    </div>
  );
}
