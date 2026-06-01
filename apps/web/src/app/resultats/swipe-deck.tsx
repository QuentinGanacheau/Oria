"use client";

import { useEffect, useRef, useState } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "framer-motion";
import { RotateCcw, ThumbsDown, ThumbsUp } from "lucide-react";
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
  // Compteurs locaux pour le tally (j'aime / passés).
  const [likes, setLikes] = useState(0);
  const [passes, setPasses] = useState(0);

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
    if (direction === "like") setLikes((v) => v + 1);
    else setPasses((v) => v + 1);
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
    // au centre, le temps de lire le tampon J'aime/Passe, avant de filer hors écran.
    animate(x, target, {
      duration: 0.7,
      ease: "easeIn",
      onComplete: () => commit(direction),
    });
  };

  // Raccourcis clavier : ← passe, → j'aime, Backspace = je ne sais pas (passer).
  // (Pas d'undo dans le modèle produit : les notes sont commit côté serveur au
  // swipe ; Backspace mappe donc l'action neutre la plus proche.)
  const flyRef = useRef(fly);
  flyRef.current = fly;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") flyRef.current("dislike");
      else if (e.key === "ArrowRight") flyRef.current("like");
      else if (e.key === "Backspace") {
        e.preventDefault();
        flyRef.current("neutral");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
    <div className="mx-auto flex w-full max-w-[440px] flex-col items-center gap-6">
      <div className="relative h-[min(66vh,600px)] w-full">
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
                  animate={{ scale: 1 - i * 0.06, y: i * 16 }}
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
                  className="pointer-events-none absolute inset-0 z-10 rounded-[24px] bg-ok"
                />
                <motion.div
                  style={{ opacity: nopeTint }}
                  className="pointer-events-none absolute inset-0 z-10 rounded-[24px] bg-no"
                />

                {/* Tampons J'aime / Passe — gros, en serif, posés sur le corps */}
                <motion.div
                  style={{ opacity: likeOpacity }}
                  className="pointer-events-none absolute right-5 top-20 z-30 rotate-[14deg] rounded-xl border-[3px] border-ok px-[18px] py-1.5 font-serif text-[34px] tracking-wide text-ok"
                >
                  J&apos;aime
                </motion.div>
                <motion.div
                  style={{ opacity: nopeOpacity }}
                  className="pointer-events-none absolute left-5 top-20 z-30 -rotate-[14deg] rounded-xl border-[3px] border-no px-[18px] py-1.5 font-serif text-[34px] tracking-wide text-no"
                >
                  Passe
                </motion.div>
              </motion.div>
            );
          })}
      </div>

      {/* Contrôles : Passe / Je ne sais pas / J'aime (= mêmes actions que le drag) */}
      <div className="flex items-center justify-center gap-[22px]">
        <button
          type="button"
          onClick={() => fly("dislike")}
          aria-label="Passer"
          className="grid size-[66px] place-items-center rounded-full border-[1.5px] border-no/35 bg-surface transition active:scale-90 hover:border-no hover:bg-no/10"
        >
          <ThumbsDown className="size-7 text-no" strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={() => fly("neutral")}
          aria-label="Je ne sais pas, passer"
          className="grid size-[50px] place-items-center rounded-full border-[1.5px] border-line-strong bg-surface transition active:scale-90 hover:border-ink-soft"
        >
          <RotateCcw className="size-5 text-muted" strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={() => fly("like")}
          aria-label="Ça m'intéresse"
          className="grid size-[66px] place-items-center rounded-full border-[1.5px] border-ok/40 bg-surface transition active:scale-90 hover:border-ok hover:bg-ok/10"
        >
          <ThumbsUp className="size-7 text-ok" strokeWidth={2} />
        </button>
      </div>

      {/* Tally : j'aime / passés / progression */}
      <div className="flex items-center justify-center gap-[18px] text-sm tabular-nums text-muted">
        <span className="inline-flex items-center gap-2">
          <ThumbsUp className="size-4 text-ok" strokeWidth={1.9} />
          <b className="font-semibold text-ink">{likes}</b> j&apos;aime
        </span>
        <span className="size-1 rounded-full bg-line-strong" />
        <span className="inline-flex items-center gap-2">
          <ThumbsDown className="size-4 text-no" strokeWidth={1.9} />
          <b className="font-semibold text-ink">{passes}</b> passés
        </span>
        <span className="size-1 rounded-full bg-line-strong" />
        <span>
          {Math.min(index, cards.length)}/{cards.length}
        </span>
      </div>
    </div>
  );
}
