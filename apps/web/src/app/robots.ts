import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://oryam.fr";

/**
 * robots.txt généré par Next.
 *
 * On autorise le crawl global mais on exclut les zones à état / personnelles :
 *  - /resultats, /questionnaire : contenu par session, sans valeur d'index
 *  - /monitoring : tunnel Sentry (voir next.config.ts, tunnelRoute)
 *  - /api : proxys éventuels
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/resultats", "/questionnaire", "/monitoring", "/api"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
