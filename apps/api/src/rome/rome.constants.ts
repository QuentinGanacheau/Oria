/**
 * Constantes du référentiel ROME 4.0 (nomenclature France Travail).
 *
 * Ces valeurs sont stables : elles font partie de la définition même du
 * référentiel et ne changent pas entre deux versions de l'API. On peut donc
 * les coder en dur en toute sécurité — c'est même plus fiable que de les
 * extraire d'une réponse API qui peut varier.
 */

/** Libellé officiel de chaque grand domaine ROME (clé = code à 1 lettre). */
export const GRAND_DOMAINE_LIBELLES: Record<string, string> = {
  A: 'Agriculture et pêche, espaces naturels et espaces verts, soins aux animaux',
  B: "Arts et façonnage d'ouvrages d'art",
  C: 'Banque, assurance, immobilier',
  D: 'Commerce, vente et grande distribution',
  E: 'Communication, média et multimédia',
  F: 'Construction, bâtiment et travaux publics',
  G: 'Hôtellerie-restauration, tourisme, loisirs et animation',
  H: 'Industrie',
  I: 'Installation et maintenance',
  J: 'Santé',
  K: 'Services à la personne et à la collectivité',
  L: 'Spectacle',
  M: "Support à l'entreprise",
  N: 'Transport et logistique',
};

/**
 * Dérive le code du grand domaine à partir d'un code métier ROME.
 * Les codes ROME suivent la structure `{lettre}{2 chiffres}{2 chiffres}`
 * où la lettre identifie le grand domaine.
 *
 * @example deriveGrandDomaineCode("M1805") → "M"
 */
export function deriveGrandDomaineCode(romeCode: string): string | null {
  if (!romeCode || romeCode.length === 0) return null;
  const first = romeCode.charAt(0).toUpperCase();
  return GRAND_DOMAINE_LIBELLES[first] ? first : null;
}

/**
 * Dérive le code du domaine professionnel (3 premiers caractères du code métier).
 * @example deriveDomaineCode("M1805") → "M18"
 */
export function deriveDomaineCode(romeCode: string): string | null {
  if (!romeCode || romeCode.length < 3) return null;
  return romeCode.slice(0, 3).toUpperCase();
}
