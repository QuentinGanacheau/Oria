import { ImageResponse } from "next/og";

// Image Open Graph générée par fiche métier. Reprend la palette de marque et
// affiche le libellé du métier. Rendue à la demande puis mise en cache (ISR).
export const alt = "Fiche métier Oryam";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type JobOg = { title: string; tagline: string };

async function fetchJob(slug: string): Promise<JobOg | null> {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/v1/jobs/${slug}`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return (await res.json()) as JobOg;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const job = await fetchJob(slug);
  const title = job?.title ?? "Fiche métier";
  const tagline = job?.tagline ?? "";

  // Taille de titre adaptative : évite le débordement pour les libellés longs.
  const titleSize = title.length > 46 ? 60 : title.length > 30 ? 72 : 88;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#F0F2EB",
          padding: "72px 80px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "#15171D",
          }}
        >
          <div style={{ width: 16, height: 16, borderRadius: 999, background: "#1E7A4D" }} />
          Oryam
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 26,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              color: "#155C3A",
            }}
          >
            Fiche métier
          </div>
          <div
            style={{
              marginTop: 18,
              fontSize: titleSize,
              lineHeight: 1.04,
              letterSpacing: "-0.03em",
              color: "#15171D",
              maxWidth: 1000,
            }}
          >
            {title}
          </div>
          {tagline ? (
            <div style={{ marginTop: 22, fontSize: 30, color: "#3D424D", maxWidth: 940 }}>
              {tagline}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", fontSize: 28, color: "#6F7682" }}>
          Missions · salaire · formations · oryam.fr
        </div>
      </div>
    ),
    { ...size },
  );
}
