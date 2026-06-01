/**
 * Contexte utilisateur transmis à toutes les couches IA.
 *
 * Permet aux prompts d'adapter leur angle d'analyse selon le profil :
 *   - "student"      → se concentrer sur le potentiel, les passions, les rêves.
 *                      L'IA ne pénalise pas l'absence d'expérience.
 *   - "professional" → exploiter l'expérience acquise, les compétences transférables,
 *                      les transitions réalistes depuis le poste actuel.
 */
export type UserTrack = 'student' | 'professional';

export type UserContext = {
  /** Réponse brute à la question `situation`. */
  situation: string;
  /**
   * Track calculé depuis `situation`.
   * Utilisé comme clé dans les templates de prompt pour éviter
   * de multiplier les conditions `if situation === 'lycee' || ...`.
   */
  track: UserTrack;
};

/** Situations correspondant au track étudiant. */
const STUDENT_SITUATIONS = new Set(['lycee', 'etudes_longues']);

/**
 * Dérive le track depuis la situation.
 * Retourne 'professional' si la situation est inconnue (défensif).
 */
export function deriveUserContext(situation: string): UserContext {
  return {
    situation,
    track: STUDENT_SITUATIONS.has(situation) ? 'student' : 'professional',
  };
}

/**
 * Instructions spécifiques au track, injectées dans les prompts IA.
 * Centralisées ici pour garantir la cohérence entre rankJobsForProfile,
 * generateRationales et generatePersonalizedSheet.
 */
export const TRACK_INSTRUCTIONS: Record<UserTrack, string> = {
  student: [
    "L'utilisateur est étudiant ou en début de parcours, sans expérience professionnelle significative.",
    "Concentre-toi sur ses passions, ses centres d'intérêt et son potentiel.",
    "Ne pénalise PAS l'absence d'expérience — oriente vers ce qui l'anime réellement.",
    "Privilégie les métiers cohérents avec ses intérêts, même si le chemin nécessite une formation.",
  ].join(' '),
  professional: [
    "L'utilisateur est en poste ou en reconversion active.",
    "Il a une expérience professionnelle réelle à valoriser.",
    "Identifie les compétences transférables depuis son parcours actuel.",
    "Privilégie les transitions réalistes : formation accessible, continuité partielle avec son passé.",
    "Sois honnête sur les reconversions qui demanderaient un effort important.",
  ].join(' '),
};
