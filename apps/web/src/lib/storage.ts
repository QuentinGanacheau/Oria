export const STORAGE_KEY = "fyj_mvp_v1";

/**
 * Portrait IA généré à la fin du questionnaire (Phase 2 produit).
 * Affiché sur l'écran intermédiaire et en haut de la page de résultats.
 * Null si l'IA était indisponible — le frontend skippe les sections concernées.
 */
export interface StoredPortrait {
  archetype: string;
  summary: string;
  strengths: string[];
  thrives: string;
  drains: string;
}

/** Un match métier tel que retourné par l'API et stocké en sessionStorage. */
export interface StoredMatch {
  job: {
    slug: string;
    title: string;
    tagline: string;
    summary: string;
    missions: string[];
    skills: string[];
    formations: string[];
    salaryRangeHint: string;
    workContext: string;
  };
  score: number;
  scorePercent: number;
  /** Explication personnalisée générée par l'IA. Absent si IA désactivée. */
  rationale?: string | null;
}

/**
 * Un paquet de métiers affinés reçu après notation (swipe deck).
 * Chaque appel à `/next-batch` côté backend produit un de ces paquets.
 */
export interface StoredRefinedBatch {
  /** Index global du paquet — 2 pour le 1er paquet affiné (1 = passe gratuite). */
  batchNumber: number;
  matches: StoredMatch[];
  /** Phrase IA affichée en transition entre deux paquets. */
  insight: string;
}

export interface StoredSession {
  sessionId: string;
  answers: Record<string, string>;
  matches: StoredMatch[];
  /**
   * L'utilisateur a fourni son email lors de la capture post-questionnaire.
   * Utilisé côté frontend pour décider si le bouton de paiement est accessible
   * directement (email déjà en DB) ou s'il faut d'abord capturer l'email.
   */
  hasEmail: boolean;
  /** Portrait IA — null si l'IA n'a pas pu le générer. */
  portrait: StoredPortrait | null;
  /**
   * Notes posées par l'utilisateur sur les métiers (Phase 4).
   * Clé = code ROME (ex: "M1805"), valeur = "like" | "dislike" | "neutral".
   */
  ratings: Record<string, 'like' | 'dislike' | 'neutral'>;
  /** Résultats affinés de la 2e passe (vue liste — legacy) — null si pas encore générés. */
  refinedMatches: StoredMatch[] | null;
  /** Phrase d'insight IA accompagnant la 2e passe (vue liste — legacy). */
  refineInsight: string | null;
  /**
   * Swipe deck : paquets affinés reçus successivement après notation.
   * Chaque entrée vient d'un appel à `/next-batch` (1er paquet affiné après paiement).
   * Absent ou vide tant que l'utilisateur n'a pas dépassé le paywall en mode deck.
   */
  batches?: StoredRefinedBatch[];
  /**
   * Swipe deck : false quand le backend signale qu'il n'y a plus de paquet
   * à générer (plafond atteint ou plus de candidats). Absent/true = on peut
   * encore en demander un.
   */
  hasMore?: boolean | null;
  savedAt: string;
}

export function loadSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export function saveSession(data: Omit<StoredSession, "savedAt">) {
  const payload: StoredSession = {
    ...data,
    savedAt: new Date().toISOString(),
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export const UNLOCK_KEY = "fyj_unlock_paid";

/**
 * Retourne true si l'utilisateur a débloqué le rapport complet.
 *
 * Deux sources possibles :
 *  1. NEXT_PUBLIC_DEV_UNLOCK=true dans .env.local → déverrouillage automatique
 *     en développement, sans passer par Stripe. Ne jamais mettre en prod.
 *  2. localStorage "fyj_unlock_paid" = "1" → déverrouillé après paiement Stripe.
 */
export function isUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NEXT_PUBLIC_DEV_UNLOCK === "true") return true;
  return localStorage.getItem(UNLOCK_KEY) === "1";
}

export function setUnlocked() {
  localStorage.setItem(UNLOCK_KEY, "1");
}
