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
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-sm font-medium text-ink">
        Un email est requis pour accéder au rapport complet
      </p>
      <p className="mt-1 text-xs text-muted">
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
          className="w-full rounded-2xl border-[1.5px] border-line bg-surface-2 px-4 py-3 text-sm outline-none transition focus:border-accent focus:bg-surface disabled:opacity-50"
        />

        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            disabled={loading}
            className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-line-strong accent-accent"
          />
          <span className="text-xs leading-relaxed text-ink-soft">
            J&apos;accepte de recevoir la confirmation de paiement et mes
            résultats par email.
          </span>
        </label>

        {error && (
          <p className="rounded-2xl border border-no/40 bg-no/10 px-3 py-2 text-xs text-no">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper transition hover:bg-accent hover:text-white disabled:cursor-not-allowed disabled:bg-line-strong disabled:text-surface disabled:hover:bg-line-strong"
          >
            {loading ? "Enregistrement…" : "Continuer vers le paiement"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="text-xs text-muted transition-colors hover:text-ink-soft disabled:opacity-50"
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
}
