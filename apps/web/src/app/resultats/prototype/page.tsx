"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SwipeDeck, { type SwipeDirection } from "../swipe-deck";
import { MOCK_JOBS } from "./mock-jobs";
import type { SwipeCardData } from "../swipe-card";

type Swiped = { card: SwipeCardData; direction: SwipeDirection };

/**
 * Prototype isolé du swipe deck (route /resultats/prototype).
 * Branché sur des données mockées — aucun appel API, aucun paiement.
 * Objectif : valider le feeling du swipe (seuil, animation, layout mobile)
 * avant de refondre la vraie page de résultats.
 */
export default function PrototypePage() {
  const router = useRouter();
  const [swiped, setSwiped] = useState<Swiped[]>([]);
  const [done, setDone] = useState(false);
  // Change de valeur pour re-monter le deck (= recommencer).
  const [runId, setRunId] = useState(0);

  const handleSwipe = (slug: string, direction: SwipeDirection) => {
    const card = MOCK_JOBS.find((j) => j.slug === slug);
    if (card) setSwiped((prev) => [...prev, { card, direction }]);
  };

  const restart = () => {
    setSwiped([]);
    setDone(false);
    setRunId((n) => n + 1);
  };

  const liked = swiped.filter((s) => s.direction === "like");
  const disliked = swiped.filter((s) => s.direction === "dislike");
  const skipped = swiped.filter((s) => s.direction === "neutral");

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 py-8 md:max-w-2xl">
      {/* En-tête prototype */}
      <div className="mb-2 flex items-center justify-between">
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
          🧪 Prototype
        </span>
        <Link
          href="/resultats"
          className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
        >
          ← Vue actuelle
        </Link>
      </div>

      {!done && (
        <>
          <div className="mb-5 text-center">
            <h1 className="text-xl font-semibold tracking-tight">
              Tes pistes métiers
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Glisse à droite si ça t&apos;intéresse, à gauche sinon.
            </p>
          </div>

          <SwipeDeck
            key={runId}
            cards={MOCK_JOBS}
            onSwipe={handleSwipe}
            onEmpty={() => setDone(true)}
            onOpenSheet={(slug) => router.push(`/metiers/${slug}`)}
          />

          {/* Tally live */}
          <div className="mt-6 flex items-center justify-center gap-4 text-sm text-slate-500 dark:text-slate-400">
            <span>👍 {liked.length}</span>
            <span>🤔 {skipped.length}</span>
            <span>👎 {disliked.length}</span>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <span>
              {swiped.length}/{MOCK_JOBS.length}
            </span>
          </div>
        </>
      )}

      {/* Écran récap (fin du deck) */}
      {done && (
        <div className="flex flex-1 flex-col">
          <h1 className="text-2xl font-semibold tracking-tight">
            Tu as exploré {swiped.length} pistes
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            (Ici, dans la vraie version, on enchaînerait sur le paywall puis un
            nouveau batch affiné par l&apos;IA.)
          </p>

          <RecapBlock title="Ça t'intéresse" color="emerald" items={liked} />
          <RecapBlock title="Pas pour toi" color="rose" items={disliked} />
          {skipped.length > 0 && (
            <RecapBlock title="À revoir" color="slate" items={skipped} />
          )}

          <button
            type="button"
            onClick={restart}
            className="mt-8 rounded-full bg-indigo-600 px-6 py-3 text-sm font-medium text-white shadow transition hover:bg-indigo-500"
          >
            ↺ Recommencer
          </button>
        </div>
      )}
    </main>
  );
}

function RecapBlock({
  title,
  color,
  items,
}: {
  title: string;
  color: "emerald" | "rose" | "slate";
  items: Swiped[];
}) {
  if (items.length === 0) return null;
  const dot =
    color === "emerald"
      ? "bg-emerald-500"
      : color === "rose"
        ? "bg-rose-500"
        : "bg-slate-400";
  return (
    <div className="mt-6">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title} ({items.length})
      </p>
      <ul className="flex flex-col gap-1.5">
        {items.map((s) => (
          <li
            key={s.card.slug}
            className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
            {s.card.title}
          </li>
        ))}
      </ul>
    </div>
  );
}
