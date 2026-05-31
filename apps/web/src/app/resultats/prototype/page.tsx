"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FlaskConical, RotateCcw } from "lucide-react";
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
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-[600px] flex-col bg-paper px-5 py-8 text-ink">
      {/* En-tête prototype */}
      <div className="mb-2 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-warn/15 px-3 py-1 text-xs font-semibold text-warn">
          <FlaskConical className="size-3.5" strokeWidth={1.9} /> Prototype
        </span>
        <Link
          href="/resultats"
          className="inline-flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-accent-ink"
        >
          <ArrowLeft className="size-3.5" /> Vue actuelle
        </Link>
      </div>

      {!done && (
        <>
          <div className="mb-6 text-center">
            <h1 className="font-serif text-[clamp(30px,5vw,40px)] leading-tight tracking-tight">
              Tes pistes métiers
            </h1>
            <p className="mt-2 text-[15.5px] text-muted">
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
        </>
      )}

      {/* Écran récap (fin du deck) */}
      {done && (
        <div className="flex flex-1 flex-col">
          <h1 className="font-serif text-[clamp(28px,4vw,40px)] leading-tight tracking-tight">
            Tu as exploré {swiped.length} pistes
          </h1>
          <p className="mt-2 text-sm text-muted">
            (Ici, dans la vraie version, on enchaînerait sur le paywall puis un
            nouveau batch affiné par l&apos;IA.)
          </p>

          <RecapBlock title="Ça t'intéresse" color="ok" items={liked} />
          <RecapBlock title="Pas pour toi" color="no" items={disliked} />
          {skipped.length > 0 && (
            <RecapBlock title="À revoir" color="muted" items={skipped} />
          )}

          <button
            type="button"
            onClick={restart}
            className="mt-8 inline-flex items-center justify-center gap-2 self-start rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper transition hover:bg-accent hover:text-white"
          >
            <RotateCcw className="size-4" /> Recommencer
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
  color: "ok" | "no" | "muted";
  items: Swiped[];
}) {
  if (items.length === 0) return null;
  const dot =
    color === "ok" ? "bg-ok" : color === "no" ? "bg-no" : "bg-line-strong";
  return (
    <div className="mt-6">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-accent-ink">
        {title} ({items.length})
      </p>
      <ul className="flex flex-col gap-1.5">
        {items.map((s) => (
          <li
            key={s.card.slug}
            className="flex items-center gap-2.5 text-sm text-ink-soft"
          >
            <span className={`size-2 shrink-0 rounded-full ${dot}`} />
            {s.card.title}
          </li>
        ))}
      </ul>
    </div>
  );
}
