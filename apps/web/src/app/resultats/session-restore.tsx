"use client";

import { useState } from "react";
import { ArrowRight, Lock } from "lucide-react";
import { apiGet } from "@/lib/api";
import {
  isUnlocked,
  saveSession,
  setUnlocked,
  type StoredPortrait,
  type StoredRefinedBatch,
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
  /** Paquets affinés (swipe deck) déjà générés pour cette session. */
  refinedBatches?: StoredRefinedBatch[];
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
        refinedMatches: null,  // Vue liste (legacy) — à re-générer si besoin
        refineInsight: null,
        // Vue swipe : restaure les paquets affinés déjà stockés en DB.
        // hasMore reste indéfini → le 1er round-end après restauration
        // appellera /next-batch qui dira si d'autres paquets sont possibles.
        batches: data.refinedBatches ?? [],
      });

      // Restaure le statut "débloqué" si l'utilisateur avait payé
      if (data.isPaid && !isUnlocked(data.sessionId)) {
        setUnlocked(data.sessionId);
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
      <div className="rounded-3xl border border-line bg-surface p-8 shadow-[0_30px_60px_-38px_rgba(20,40,25,.28)]">
        {/* Icône + titre */}
        <div className="text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-accent-soft">
            <Lock className="size-7 text-accent-ink" strokeWidth={1.7} />
          </div>
          <h1 className="mt-4 font-serif text-2xl tracking-tight">
            Retrouve tes résultats
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            Entre l&apos;email que tu avais utilisé pour recevoir tes résultats.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          <div>
            <label
              htmlFor="restore-email"
              className="mb-1.5 block text-sm font-medium text-ink-soft"
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
              className="w-full rounded-2xl border-[1.5px] border-line bg-surface-2 px-[18px] py-3.5 text-base outline-none transition focus:border-accent focus:bg-surface disabled:opacity-50"
            />
          </div>

          {error && (
            <p className="rounded-2xl border border-no/40 bg-no/10 px-4 py-3 text-sm text-no">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!isEmailValid || loading}
            className="group inline-flex items-center justify-center gap-2 rounded-full bg-ink px-6 py-3.5 font-semibold text-paper transition hover:bg-accent hover:text-white disabled:cursor-not-allowed disabled:bg-line-strong disabled:text-surface disabled:hover:bg-line-strong"
          >
            {loading ? "Vérification…" : "Accéder à mes résultats"}
            {!loading && <ArrowRight className="size-4 transition-transform group-enabled:group-hover:translate-x-0.5" />}
          </button>
        </form>
      </div>
    </div>
  );
}
