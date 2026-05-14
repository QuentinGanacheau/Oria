"use client";

import { useState } from "react";
import { apiGet } from "@/lib/api";
import {
  isUnlocked,
  saveSession,
  setUnlocked,
  type StoredPortrait,
  type StoredSession,
} from "@/lib/storage";

/**
 * Gate de restauration de session via lien email.
 *
 * Affiché quand l'URL contient ?sessionId=xxx mais que le localStorage ne
 * contient pas cette session (browser fermé, autre appareil, cookie vidé…).
 *
 * Principe anti-partage : l'utilisateur doit entrer l'email associé à la session.
 * Sans ça, un tiers qui obtiendrait l'URL ne pourrait pas voir les résultats.
 *
 * États gérés :
 *   - idle     → formulaire email affiché
 *   - loading  → appel API en cours
 *   - error    → email incorrect / session expirée / introuvable
 *   - success  → session restaurée, onRestored() déclenché
 */

type RestoreResponse = {
  sessionId: string;
  matches: StoredSession["matches"];
  isPaid: boolean;
  expiresAt: string | null;
  /** Portrait IA (Phase 2) — null si non généré ou IA indisponible. */
  portrait: StoredPortrait | null;
};

type Props = {
  /** sessionId issu du paramètre ?sessionId= de l'URL. */
  sessionId: string;
  /** Appelé une fois la session restaurée avec succès. */
  onRestored: () => void;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SessionRestore({ sessionId, onRestored }: Props) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEmailValid = EMAIL_REGEX.test(email.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmailValid || loading) return;

    setLoading(true);
    setError(null);

    try {
      const data = await apiGet<RestoreResponse>(
        `/v1/questionnaire/${sessionId}/results?email=${encodeURIComponent(email.trim())}`,
      );

      // Restaure la session dans localStorage
      saveSession({
        sessionId: data.sessionId,
        answers: {},
        matches: data.matches,
        hasEmail: true,
        portrait: data.portrait,
        ratings: {},           // Les notes ne sont pas persistées en DB
        refinedMatches: null,  // À re-générer si besoin
        refineInsight: null,
      });

      // Restaure le statut "débloqué" si l'utilisateur avait payé
      if (data.isPaid && !isUnlocked()) {
        setUnlocked();
      }

      onRestored();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur réseau";

      // Transforme les messages d'erreur API en messages utilisateur lisibles
      if (message.includes("expiré")) {
        setError(
          "Tes résultats ont expiré. Lance un nouveau questionnaire pour une analyse fraîche.",
        );
      } else if (
        message.includes("Email incorrect") ||
        message.includes("email")
      ) {
        setError("Email non reconnu pour ce lien. Vérifie l'adresse utilisée.");
      } else if (message.includes("introuvable")) {
        setError("Lien invalide ou expiré.");
      } else {
        setError("Impossible de restaurer tes résultats. Réessaie.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-6 py-20">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {/* Icône + titre */}
        <div className="text-center">
          <p className="text-3xl">🔐</p>
          <h1 className="mt-3 text-xl font-semibold tracking-tight">
            Retrouve tes résultats
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Entre l&apos;email que tu avais utilisé pour recevoir tes résultats.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          <div>
            <label
              htmlFor="restore-email"
              className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Ton email
            </label>
            <input
              id="restore-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              placeholder="prenom@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:focus:border-indigo-500 dark:focus:bg-slate-900"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!isEmailValid || loading}
            className="rounded-full bg-indigo-600 px-6 py-3 font-medium text-white shadow transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Vérification…" : "Accéder à mes résultats →"}
          </button>
        </form>
      </div>
    </div>
  );
}
