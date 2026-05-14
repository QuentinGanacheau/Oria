"use client";

import { useState } from "react";
import Link from "next/link";
import { apiPost } from "@/lib/api";

/**
 * Écran de capture d'email entre la fin du questionnaire et l'affichage
 * des résultats.
 *
 * Stratégie "gate doux" :
 *  - formulaire prééminent (email + consentement RGPD)
 *  - bouton skip discret pour les utilisateurs qui refusent
 *
 * Ce composant ne sait rien du routing ni de la persistance — il appelle
 * juste `onComplete()` quand l'utilisateur a soit envoyé son email avec
 * succès, soit choisi de continuer sans. Le parent décide du reste.
 */

type Props = {
  /** ID de la session questionnaire (transmis à l'API). */
  sessionId: string;
  /** Nombre total de matches à afficher (pour le teaser). */
  matchCount: number;
  /**
   * Callback déclenché à la fin de l'écran.
   * @param hasEmail true si l'email a été capturé avec succès,
   *                 false si l'utilisateur a cliqué "continuer sans".
   * Le parent utilise ce flag pour savoir si le bouton de paiement sera
   * accessible directement ou nécessitera une capture email préalable.
   */
  onComplete: (hasEmail: boolean) => void;
};

// Regex email pragmatique — couvre 99% des cas réels sans être trop strict.
// La validation finale est faite par class-validator côté API.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EmailGate({
  sessionId,
  matchCount,
  onComplete,
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
      await apiPost<{ ok: boolean; emailSent: boolean }>(
        "/v1/email/capture",
        {
          sessionId,
          email: email.trim(),
          consent: true,
        },
      );
      // L'envoi de l'email est best-effort côté backend — même si Resend
      // est HS, l'API retourne ok: true et on continue le flow utilisateur.
      onComplete(true);
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
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {/* Hero rassurant : on confirme que les résultats sont prêts */}
      <div className="text-center">
        <p className="text-3xl">🎯</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          Tes {matchCount} pistes métiers sont prêtes
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          Reçois-les par email pour y revenir tranquillement plus tard.
        </p>
      </div>

      {/* Formulaire de capture */}
      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200"
          >
            Ton email
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            placeholder="prenom@exemple.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:focus:border-indigo-500 dark:focus:bg-slate-900 dark:focus:ring-indigo-950"
          />
        </div>

        {/* Consentement RGPD — case décochée par défaut, formulation claire */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            disabled={loading}
            className="mt-0.5 h-4 w-4 cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-800"
          />
          <span className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            J&apos;accepte de recevoir mes résultats par email. Pas de spam,
            désabonnement en un clic.{" "}
            <Link
              href="/confidentialite"
              target="_blank"
              className="text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-400"
            >
              Politique de confidentialité
            </Link>
          </span>
        </label>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-full bg-indigo-600 px-6 py-3 text-base font-medium text-white shadow transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-indigo-600"
        >
          {loading ? "Envoi en cours…" : "Voir mes résultats →"}
        </button>
      </form>

      {/* Skip discret — pour ne pas bloquer ceux qui refusent */}
      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => onComplete(false)}
          disabled={loading}
          className="text-xs text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline disabled:opacity-50 dark:text-slate-500 dark:hover:text-slate-300"
        >
          Continuer sans email
        </button>
      </div>
    </div>
  );
}
