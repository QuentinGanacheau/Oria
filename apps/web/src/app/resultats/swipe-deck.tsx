"use client";

import { useState } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "framer-motion";
import SwipeCard, { type SwipeCardData } from "./swipe-card";

export type SwipeDirection = "like" | "dislike" | "neutral";

type Props = {
  cards: SwipeCardData[];
  /** Appelé à chaque carte swipée (avant l'avancement du deck). */
  onSwipe: (slug: string, direction: SwipeDirection) => void;
  /** Appelé quand la dernière carte a été swipée. */
  onEmpty?: () => void;
  /** Ouvre la fiche métier complète (navigation hors du deck). */
  onOpenSheet?: (slug: string) => void;
};

/** Déplacement horizontal (px) au-delà duquel un swipe est validé. */
const SWIPE_THRESHOLD = 100;
/** Vitesse de "flick" qui valide un swipe même sans atteindre le seuil. */
const VELOCITY_THRESHOLD = 600;

export default function SwipeDeck({
  cards,
  onSwipe,
  onEmpty,
  onOpenSheet,
}: Props) {
  // Index de la carte du dessus dans `cards`.
  const [index, setIndex] = useState(0);
  // Verrou pendant l'animation de sortie (évite le double-swipe).
  const [animating, setAnimating] = useState(false);

  // Position de la carte du dessus, pilotée par le drag.
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Valeurs dérivées de x : rotation de la carte + opacité des overlays.
  const rotate = useTransform(x, [-250, 0, 250], [-16, 0, 16]);
  // Les tampons atteignent leur pleine intensité bien avant le seuil (~80px)
  // pour que le choix soit lisible pendant tout le geste.
  const likeOpacity = useTransform(x, [10, 80], [0, 1]);
  const nopeOpacity = useTransform(x, [-80, -10], [1, 0]);
  // Teinte plein-carte : renforce le signal de direction (vert = oui, rouge = non).
  const likeTint = useTransform(x, [0, 120], [0, 0.35]);
  const nopeTint = useTransform(x, [-120, 0], [0.35, 0]);

  const reset = () => {
    x.set(0);
    y.set(0);
  };

  /** Enregistre le swipe et passe à la carte suivante. */
  const commit = (direction: SwipeDirection) => {
    const card = cards[index];
    if (card) onSwipe(card.slug, direction);
    reset();
    const next = index + 1;
    setIndex(next);
    setAnimating(false);
    if (next >= cards.length) onEmpty?.();
  };

  /** Anime la carte hors de l'écran puis valide le swipe. */
  const fly = (direction: SwipeDirection) => {
    if (animating) return;
    setAnimating(true);
    if (direction === "neutral") {
      const height = typeof window !== "undefined" ? window.innerHeight : 800;
      animate(y, -height, {
        duration: 0.45,
        ease: "easeIn",
        onComplete: () => commit("neutral"),
      });
      return;
    }
    const width = typeof window !== "undefined" ? window.innerWidth : 600;
    const target = direction === "like" ? width * 1.2 : -width * 1.2;
    // Sortie en easeIn (départ lent → accélération) : la carte reste un instant
    // au centre, le temps de lire le tampon OUI/NON, avant de filer hors écran.
    animate(x, target, {
      duration: 0.7,
      ease: "easeIn",
      onComplete: () => commit(direction),
    });
  };

  const handleDragEnd = (
    _e: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    const { offset, velocity } = info;
    if (offset.x > SWIPE_THRESHOLD || velocity.x > VELOCITY_THRESHOLD) {
      fly("like");
    } else if (offset.x < -SWIPE_THRESHOLD || velocity.x < -VELOCITY_THRESHOLD) {
      fly("dislike");
    }
    // Sinon : dragSnapToOrigin recentre la carte automatiquement.
  };

  if (index >= cards.length) return null;

  // Carte du dessus + 2 derrière pour l'effet de pile.
  const stack = cards.slice(index, index + 3);

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-3 md:max-w-xl md:gap-4">
      <div className="relative h-[min(66vh,520px)] w-full md:h-[min(74vh,660px)]">
        {stack
          .map((card, i) => ({ card, i }))
          .reverse() // les cartes du fond rendues en premier (z-index naturel)
          .map(({ card, i }) => {
            const isTop = i === 0;

            if (!isTop) {
              return (
                <motion.div
                  key={card.slug}
                  className="absolute inset-0"
                  initial={false}
                  animate={{ scale: 1 - i * 0.05, y: i * 16 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  style={{ zIndex: 10 - i }}
                >
                  <SwipeCard data={card} rank={index + i + 1} />
                </motion.div>
              );
            }

            return (
              <motion.div
                key={card.slug}
                className="absolute inset-0 cursor-grab active:cursor-grabbing"
                style={{ x, y, rotate, zIndex: 20, touchAction: "pan-y" }}
                drag
                dragSnapToOrigin
                dragElastic={0.6}
                dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                onDragEnd={handleDragEnd}
              >
                <SwipeCard
                  data={card}
                  rank={index + 1}
                  onOpenSheet={onOpenSheet}
                />

                {/* Teinte plein-carte selon la direction du swipe */}
                <motion.div
                  style={{ opacity: likeTint }}
                  className="pointer-events-none absolute inset-0 z-10 rounded-3xl bg-emerald-400"
                />
                <motion.div
                  style={{ opacity: nopeTint }}
                  className="pointer-events-none absolute inset-0 z-10 rounded-3xl bg-rose-400"
                />

                {/* Tampons OUI / NON — gros, posés sur le corps blanc (pas le bandeau) */}
                <motion.div
                  style={{ opacity: likeOpacity }}
                  className="pointer-events-none absolute left-6 top-20 z-30 -rotate-12 rounded-2xl border-[6px] border-emerald-500 bg-white/85 px-6 py-2 text-5xl font-black uppercase tracking-wider text-emerald-600 shadow-xl dark:bg-slate-900/85"
                >
                  Oui
                </motion.div>
                <motion.div
                  style={{ opacity: nopeOpacity }}
                  className="pointer-events-none absolute right-6 top-20 z-30 rotate-12 rounded-2xl border-[6px] border-rose-500 bg-white/85 px-6 py-2 text-5xl font-black uppercase tracking-wider text-rose-600 shadow-xl dark:bg-slate-900/85"
                >
                  Non
                </motion.div>
              </motion.div>
            );
          })}
      </div>

      {/* Boutons fallback — desktop + accessibilité (= mêmes actions que le drag) */}
      <div className="flex items-center justify-center gap-5">
        <button
          type="button"
          onClick={() => fly("dislike")}
          aria-label="Pas pour moi"
          className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-rose-200 bg-white text-2xl shadow-sm transition hover:border-rose-400 hover:bg-rose-50 dark:border-rose-900 dark:bg-slate-800 dark:hover:bg-rose-950/40"
        >
          👎
        </button>
        <button
          type="button"
          onClick={() => fly("neutral")}
          aria-label="Je ne sais pas, passer"
          className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-slate-200 bg-white text-xl shadow-sm transition hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
        >
          ↩
        </button>
        <button
          type="button"
          onClick={() => fly("like")}
          aria-label="Ça m'intéresse"
          className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-emerald-200 bg-white text-2xl shadow-sm transition hover:border-emerald-400 hover:bg-emerald-50 dark:border-emerald-900 dark:bg-slate-800 dark:hover:bg-emerald-950/40"
        >
          👍
        </button>
      </div>
    </div>
  );
}
