"use client";

import { useEffect, useState } from "react";
import { Bookmark } from "lucide-react";

/** Clé localStorage stockant la liste des slugs de métiers enregistrés. */
const KEY = "fyj-saved";

function readSaved(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? (raw as string[]) : [];
  } catch {
    return [];
  }
}

/** Bouton « Enregistrer » (toggle) — persiste le slug dans localStorage. */
export default function SaveButton({ slug }: { slug: string }) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(readSaved().includes(slug));
  }, [slug]);

  const toggle = () => {
    setSaved((prev) => {
      const next = !prev;
      try {
        const set = new Set(readSaved());
        if (next) set.add(slug);
        else set.delete(slug);
        localStorage.setItem(KEY, JSON.stringify([...set]));
      } catch {
        // localStorage indisponible — toggle éphémère, sans persistance.
      }
      return next;
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition ${
        saved
          ? "border-accent bg-accent text-white"
          : "border-line-strong bg-surface text-ink hover:border-accent"
      }`}
    >
      <Bookmark
        className={`size-4 ${saved ? "fill-white" : "text-accent-ink"}`}
        strokeWidth={1.8}
      />
      <span className="hidden sm:inline">{saved ? "Enregistré" : "Enregistrer"}</span>
    </button>
  );
}
