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
  title: "Oryam — Métiers qui te ressemblent",
  description:
    "Questionnaire dynamique et fiches métiers. SaaS d’orientation et de reconversion professionnelle.",
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
