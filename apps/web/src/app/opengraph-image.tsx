import { ImageResponse } from "next/og";

// Image Open Graph par défaut (partages de la home et fallback des pages sans
// image dédiée). 1200×630, rendue via next/og. Palette de marque (globals.css).
export const alt = "Oryam — le bilan de compétence express, en 20 minutes";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
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
            Orientation &amp; reconversion
          </div>
          <div
            style={{
              marginTop: 20,
              fontSize: 76,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              color: "#15171D",
              maxWidth: 940,
            }}
          >
            Le bilan de compétence express, en 20 minutes.
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 28, color: "#6F7682" }}>
          Explore les métiers qui te ressemblent · oryam.fr
        </div>
      </div>
    ),
    { ...size },
  );
}
