import type { Metadata } from "next";
import { Instrument_Serif, Space_Grotesk } from "next/font/google";
import { AnalyticsProvider } from "@/components/analytics-provider";
import "./globals.css";

const serif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

const sans = Space_Grotesk({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  // Base absolue pour résoudre les URLs Open Graph / canonical relatives.
  // En prod : oryam.fr. Surchargée par NEXT_PUBLIC_SITE_URL si défini (preview Vercel).
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://oryam.fr",
  ),
  title: {
    default: "Oryam — Le bilan de compétence express, en 20 minutes",
    template: "%s | Oryam",
  },
  description:
    "Explore les métiers qui te ressemblent en 20 minutes. L'alternative digitale et abordable au bilan de compétence, pour ton orientation ou ta reconversion.",
  applicationName: "Oryam",
  keywords: [
    "bilan de compétence",
    "orientation",
    "reconversion professionnelle",
    "test métier",
    "fiche métier",
    "orientation scolaire",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Oryam",
    url: "/",
    title: "Oryam — Le bilan de compétence express, en 20 minutes",
    description:
      "Explore les métiers qui te ressemblent en 20 minutes. L'alternative digitale et abordable au bilan de compétence.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Oryam — Le bilan de compétence express, en 20 minutes",
    description:
      "Explore les métiers qui te ressemblent en 20 minutes. L'alternative digitale et abordable au bilan de compétence.",
  },
  manifest: "/site.webmanifest",
  icons: {
    // On n'expose pas le favicon.svg (1,1 Mo : image raster embarquée) —
    // le PNG 96×96 (8 Ko) suffit largement pour l'onglet du navigateur.
    icon: [{ url: "/favicon-96x96.png", type: "image/png", sizes: "96x96" }],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    title: "Oryam",
  },
};

// Anti-FOUC : applique le thème stocké (clé `fyj-mode`) avant le premier paint.
const themeScript = `(function(){try{var m=localStorage.getItem("fyj-mode");document.documentElement.dataset.mode=m==="dark"?"dark":"light";}catch(e){document.documentElement.dataset.mode="light";}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${serif.variable} ${sans.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen antialiased">
        <AnalyticsProvider />
        {children}
      </body>
    </html>
  );
}
