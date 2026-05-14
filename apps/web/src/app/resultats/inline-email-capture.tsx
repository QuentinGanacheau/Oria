"use client";

import { useState } from "react";
import { apiPost } from "@/lib/api";

/**
 * Capture d'email inline dans la page résultats.
 *
 * Affiché uniquement quand l'utilisateur clique "Voir les X autres métiers"
 * sans avoir fourni son email lors du questionnaire (skip sur la EmailGate).
 *
 * L'email est obligatoire pour payer car il sert à :
 *  1. Envoyer la confirmation de paiement
 *  2. Permettre la restauration des résultats après fermeture du navigateur
 *
 * Design volontairement compact (pas de pleine page) : on est déjà sur
 * la page /resultats, on ne veut pas interrompre le flow avec un grand écran.
 */

type Props = {
  sessionId: string;
  /** Appelé quand l'email a bien été capturé → le parent relance le checkout */
  onCaptured: () => void;
  /** Appelé si l'utilisateur annule → le parent ferme le formulaire */
  onCancel: () => void;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function InlineEmailCapture({
  sessionId,
  onCaptured,
  onCancel,
}: Props) {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEmailValid = EMAIL_REGEX.test(email.trim());
  const canSubmit = isEmailValid && consent && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError(null);
    try {
      await apiPost<{ ok: boolean }>("/v1/email/capture", {
        sessionId,
        email: email.trim(),
        consent: true,
      });
      onCaptured();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible d'enregistrer ton email. Réessaie.",
      );
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-indigo-200 bg-white p-5 dark:border-indigo-800 dark:bg-slate-900">
      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
        Un email est requis pour accéder au rapport complet
      </p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Il sert à t&apos;envoyer la confirmation et te permettre de retrouver
        tes résultats plus tard.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="prenom@exemple.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:focus:border-indigo-500 dark:focus:bg-slate-900"
        />

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            disabled={loading}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-2 focus:ring-indigo-200"
          />
          <span className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            J&apos;accepte de recevoir la confirmation de paiement et mes
            résultats par email.
          </span>
        </label>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-medium text-white shadow transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Enregistrement…" : "Continuer vers le paiement →"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="text-xs text-slate-400 hover:text-slate-600 disabled:opacity-50"
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
}
