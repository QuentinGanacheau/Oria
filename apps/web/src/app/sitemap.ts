import type { MetadataRoute } from "next";

/**
 * Sitemap dynamique.
 *
 * Combine les pages statiques indexables et l'ensemble des fiches métier ROME
 * (récupérées via l'API `GET /v1/jobs`). Les pages à état / personnelles
 * (`/resultats`, `/questionnaire`) sont volontairement absentes — elles sont
 * `noindex` et n'ont pas à être crawlées.
 *
 * Revalidé toutes les heures : la liste des métiers change rarement.
 */
export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://oryam.fr";

type JobListItem = { slug: string };

async function fetchJobSlugs(): Promise<string[]> {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/v1/jobs`, { next: { revalidate } });
    if (!res.ok) return [];
    const jobs = (await res.json()) as JobListItem[];
    return jobs.map((j) => j.slug).filter(Boolean);
  } catch {
    // API indisponible au build/revalidate : on renvoie au moins les pages
    // statiques plutôt que de faire échouer la génération du sitemap.
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/metiers`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/mentions-legales`, changeFrequency: "yearly", priority: 0.1 },
    { url: `${SITE_URL}/cgv`, changeFrequency: "yearly", priority: 0.1 },
    { url: `${SITE_URL}/confidentialite`, changeFrequency: "yearly", priority: 0.1 },
  ];

  const slugs = await fetchJobSlugs();
  const jobRoutes: MetadataRoute.Sitemap = slugs.map((slug) => ({
    url: `${SITE_URL}/metiers/${slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...jobRoutes];
}
