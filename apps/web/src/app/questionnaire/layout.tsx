import type { Metadata } from "next";

// `questionnaire/page.tsx` est un composant client (`"use client"`) et ne peut
// donc pas exporter de `metadata`. Ce layout serveur porte le `noindex` :
// le questionnaire est un parcours à état, sans valeur d'index.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function QuestionnaireLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
