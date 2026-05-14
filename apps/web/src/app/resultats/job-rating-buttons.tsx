"use client";

import { useState } from "react";
import { apiPost } from "@/lib/api";

type RatingValue = "like" | "dislike" | "neutral";

/**
 * Raisons pré-définies pour le rejet d'un métier.
 * Présentées sous forme de chips sélectionnables (inspiré SUGGESTIONS_WITH_TEXT).
 * Chaque chip a un libellé affiché + un signal IA implicite.
 */
const DISLIKE_REASONS = [
  "Trop de contact client",
  "Formation trop longue",
  "Salaire trop bas",
  "Pas assez créatif",
  "Trop physique",
  "Trop solitaire",
  "Pas assez de sens",
  "Horaires contraignants",
];

type Props = {
  sessionId: string;
  jobSlug: string;
  /** Note actuelle stockée en localStorage (si déjà notée). */
  currentRating?: RatingValue;
  /** Appelé quand la note est enregistrée (met à jour le state parent). */
  onRated: (rating: RatingValue, reason?: string) => void;
};

export default function JobRatingButtons({
  sessionId,
  jobSlug,
  currentRating,
  onRated,
}: Props) {
  const [rating, setRating] = useState<RatingValue | null>(currentRating ?? null);
  const [showReasonPanel, setShowReasonPanel] = useState(false);
  const [selectedReasons, setSelectedReasons] = useState<Set<string>>(new Set());
  const [customReason, setCustomReason] = useState("");
  const [saving, setSaving] = useState(false);

  /** Enregistre une note sans raison (like / neutral). */
  const saveRating = async (value: RatingValue, reason?: string) => {
    setSaving(true);
    try {
      await apiPost(`/v1/questionnaire/${sessionId}/rate`, {
        jobSlug,
        rating: value,
        ...(reason ? { reason } : {}),
      });
      setRating(value);
      onRated(value, reason);
    } catch {
      // Silencieux : la note sera réessayée au prochain clic
    } finally {
      setSaving(false);
    }
  };

  const handleLike = () => {
    setShowReasonPanel(false);
    void saveRating("like");
  };

  const handleNeutral = () => {
    setShowReasonPanel(false);
    void saveRating("neutral");
  };

  const handleDislike = () => {
    if (rating === "dislike") {
      // Deuxième clic sur 👎 → rouvre le panneau pour modifier la raison
      setShowReasonPanel((v) => !v);
    } else {
      // Enregistre le dislike immédiatement — la carte passe en rouge de suite.
      // Le panneau s'ouvre ensuite pour enrichir avec une raison (optionnel).
      void saveRating("dislike");
      setShowReasonPanel(true);
    }
  };

  const toggleReason = (reason: string) => {
    setSelectedReasons((prev) => {
      const next = new Set(prev);
      if (next.has(reason)) next.delete(reason);
      else next.add(reason);
      return next;
    });
  };

  const submitDislike = async () => {
    // Met à jour le dislike déjà enregistré avec la raison choisie
    const parts = [...selectedReasons, customReason.trim()].filter(Boolean);
    const reason = parts.length > 0 ? parts.join(". ") : undefined;
    await saveRating("dislike", reason);
    setShowReasonPanel(false);
  };

  const skipDislike = () => {
    // Le dislike est déjà enregistré (sans raison) — on ferme juste le panneau
    setShowReasonPanel(false);
  };

  const btnBase =
    "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50";

  const btnLike =
    rating === "like"
      ? `${btnBase} border-emerald-400 bg-emerald-100 text-emerald-700 dark:border-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300`
      : `${btnBase} border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300`;

  const btnNeutral =
    rating === "neutral"
      ? `${btnBase} border-slate-400 bg-slate-200 text-slate-700 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-200`
      : `${btnBase} border-slate-200 bg-white text-slate-500 hover:border-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400`;

  const btnDislike =
    rating === "dislike"
      ? `${btnBase} border-rose-400 bg-rose-100 text-rose-700 dark:border-rose-700 dark:bg-rose-900/40 dark:text-rose-300`
      : `${btnBase} border-slate-200 bg-white text-slate-600 hover:border-rose-300 hover:bg-rose-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300`;

  return (
    <div className="mt-4">
      {/* Boutons de notation */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-400 dark:text-slate-500">
          Ce métier te parle ?
        </span>
        <button
          type="button"
          disabled={saving}
          onClick={handleLike}
          className={btnLike}
          title="Ça m'intéresse"
        >
          👍 <span>Ça m&apos;intéresse</span>
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={handleNeutral}
          className={btnNeutral}
          title="Je sais pas"
        >
          🤔 <span>Je sais pas</span>
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={handleDislike}
          className={btnDislike}
          title="Pas pour moi"
        >
          👎 <span>Pas pour moi</span>
        </button>
      </div>

      {/* Panneau de raison (affiché uniquement sur 👎) */}
      {showReasonPanel && (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50/60 p-4 dark:border-rose-900/50 dark:bg-rose-950/20">
          <p className="mb-3 text-xs font-medium text-rose-700 dark:text-rose-400">
            Pourquoi ? <span className="font-normal opacity-70">(optionnel)</span>
          </p>

          {/* Chips de raisons pré-définies */}
          <div className="flex flex-wrap gap-1.5">
            {DISLIKE_REASONS.map((reason) => {
              const selected = selectedReasons.has(reason);
              return (
                <button
                  key={reason}
                  type="button"
                  onClick={() => toggleReason(reason)}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    selected
                      ? "border-rose-400 bg-rose-200 text-rose-800 dark:border-rose-600 dark:bg-rose-900/60 dark:text-rose-200"
                      : "border-rose-200 bg-white text-rose-600 hover:border-rose-400 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-400"
                  }`}
                >
                  {selected ? "✓ " : ""}{reason}
                </button>
              );
            })}
          </div>

          {/* Texte libre optionnel */}
          <textarea
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            placeholder="Autre raison…"
            rows={2}
            maxLength={300}
            className="mt-3 w-full resize-none rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs outline-none transition focus:border-rose-400 dark:border-rose-800 dark:bg-slate-900 dark:focus:border-rose-600"
          />

          {/* Actions */}
          <div className="mt-3 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={skipDislike}
              disabled={saving}
              className="text-xs text-slate-400 hover:text-slate-600 disabled:opacity-50"
            >
              Passer sans préciser
            </button>
            <button
              type="button"
              onClick={() => void submitDislike()}
              disabled={saving}
              className="rounded-full bg-rose-600 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-rose-500 disabled:opacity-60"
            >
              {saving ? "Enregistrement…" : "Valider"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
