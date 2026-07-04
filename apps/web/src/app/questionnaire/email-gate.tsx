"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Target } from "lucide-react";
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
    <div className="rounded-3xl border border-line bg-surface p-7 shadow-[0_30px_60px_-38px_rgba(20,40,25,.28)] sm:p-12">
      {/* Hero rassurant : on confirme que les résultats sont prêts */}
      <div className="text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-accent-soft">
          <Target className="size-8 text-accent-ink" strokeWidth={1.7} />
        </div>
        <h1 className="mt-4 font-serif text-3xl tracking-tight">
          Tes premières pistes métiers sont prêtes
        </h1>
        <p className="mt-2 text-ink-soft">
          Reçois ton portrait et tes résultats par email pour y revenir
          tranquillement plus tard.
        </p>
      </div>

      {/* Formulaire de capture */}
      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-sm font-medium text-ink-soft"
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
            className="w-full rounded-2xl border-[1.5px] border-line bg-surface-2 px-[18px] py-3.5 text-base outline-none transition focus:border-accent focus:bg-surface disabled:opacity-50"
          />
        </div>

        {/* Consentement RGPD — case décochée par défaut, formulation claire */}
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            disabled={loading}
            className="mt-0.5 size-4 cursor-pointer rounded border-line-strong accent-accent"
          />
          <span className="text-sm leading-relaxed text-ink-soft">
            J&apos;accepte de recevoir mes résultats par email. Pas de spam,
            désabonnement en un clic.{" "}
            <Link
              href="/confidentialite"
              target="_blank"
              className="text-accent-ink underline-offset-2 hover:underline"
            >
              Politique de confidentialité
            </Link>
          </span>
        </label>

        {error && (
          <p className="rounded-2xl border border-no/40 bg-no/10 px-4 py-3 text-sm text-no">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="group inline-flex items-center justify-center gap-2 rounded-full bg-ink px-6 py-3.5 text-base font-semibold text-paper transition hover:bg-accent hover:text-white disabled:cursor-not-allowed disabled:bg-line-strong disabled:text-surface disabled:hover:bg-line-strong"
        >
          {loading ? "Envoi en cours…" : "Voir mes résultats"}
          {!loading && <ArrowRight className="size-4 transition-transform group-enabled:group-hover:translate-x-0.5" />}
        </button>
      </form>

      {/* Skip discret — pour ne pas bloquer ceux qui refusent */}
      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => onComplete(false)}
          disabled={loading}
          className="text-xs text-muted underline-offset-2 transition-colors hover:text-ink-soft hover:underline disabled:opacity-50"
        >
          Continuer sans email
        </button>
      </div>
    </div>
  );
}
