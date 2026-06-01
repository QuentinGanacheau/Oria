"use client";

import { useEffect, useState } from "react";

type Mode = "light" | "dark";

/**
 * Bouton rond de bascule de thème. Le mode est appliqué très tôt par le script
 * anti-FOUC de `layout.tsx` ; ce composant se synchronise au montage puis pilote
 * `document.documentElement.dataset.mode` et persiste sous la clé `fyj-mode`.
 */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [mode, setMode] = useState<Mode>("light");

  useEffect(() => {
    const current =
      (document.documentElement.dataset.mode as Mode | undefined) ?? "light";
    setMode(current === "dark" ? "dark" : "light");
  }, []);

  const toggle = () => {
    const next: Mode = mode === "dark" ? "light" : "dark";
    setMode(next);
    document.documentElement.dataset.mode = next;
    try {
      localStorage.setItem("fyj-mode", next);
    } catch {
      // localStorage indisponible (mode privé) — bascule éphémère, sans persistance.
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Changer de thème"
      className={`grid size-10 flex-none place-items-center rounded-full border border-line-strong bg-surface text-ink-soft transition-colors hover:border-accent hover:text-accent-ink ${className}`}
    >
      {mode === "dark" ? (
        <svg
          viewBox="0 0 24 24"
          className="size-[18px]"
          stroke="currentColor"
          strokeWidth={1.7}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          className="size-[18px]"
          stroke="currentColor"
          strokeWidth={1.7}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      )}
    </button>
  );
}
