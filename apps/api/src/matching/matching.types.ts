/**
 * Types du pipeline de matching ROME (Phase 2).
 *
 * Volontairement séparés des entités Prisma : ils représentent les contrats
 * entre les services du module, indépendamment du stockage.
 */

/** Code ROME d'un grand domaine (ex: "M", "J", "K"). */
export type DomainCode = string;

/** Réponse normalisée pour l'entrée du matching. */
export type MatchingAnswer = {
  /** Texte de la question (utilisé pour le prompt IA). */
  question: string;
  /** Réponse de l'utilisateur (label option ou texte libre). */
  answer: string;
  /** Poids des grands domaines pour cette option (null pour texte libre). */
  domainWeights: Record<DomainCode, number> | null;
};

/** Métier candidat au reranking IA (forme minimale = code + libellé). */
export type JobCandidate = {
  code: string;
  libelle: string;
  /** Définition courte — facultative, alourdit le prompt IA si fournie. */
  definition?: string | null;
  /** Grand domaine d'origine (utile pour traçabilité). */
  codeGrandDomaine?: string | null;
};

/** Résultat final d'un matching. */
export type MatchedJob = {
  code: string;
  libelle: string;
  /** Score normalisé sur 100. */
  score: number;
  /** Rang dans le classement (1 = meilleur). */
  rank: number;
};

/** Options du pipeline complet. */
export type MatchingOptions = {
  /** Nombre de grands domaines à retenir avant reranking. */
  topDomainsCount?: number;
  /** Nombre de métiers retournés au final. */
  finalTopN?: number;
  /**
   * Contexte utilisateur pour adapter les prompts IA.
   * Optionnel — si absent, le track 'professional' est utilisé par défaut.
   */
  userContext?: import('../ai/user-context').UserContext;
};
