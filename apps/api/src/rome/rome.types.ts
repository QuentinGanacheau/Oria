/**
 * Types des réponses de l'API France Travail ROME 4.0.
 *
 * Note : la structure peut évoluer côté France Travail. On garde des champs
 * optionnels partout pour ne pas faire planter le sync si un champ disparaît.
 * Source : https://francetravail.io/data/api/rome
 */

/** Item retourné par la liste des métiers (champs minimaux). */
export type RomeMetierListItem = {
  code: string;
  libelle: string;
};

/**
 * Type d'une compétence ROME. Valeurs courantes observées :
 *  - "COMPETENCE-DETAILLEE" : action concrète ("Concevoir une application web")
 *  - "SAVOIR"               : connaissance théorique ("Application web")
 *  - "SAVOIR-FAIRE"         : ancien type, encore présent dans certaines fiches
 */
export type RomeCompetence = {
  type?: string;
  code?: string;
  libelle: string;
  codeOgr?: string;
};

export type RomeContexteTravail = {
  code?: string;
  libelle: string;
  categorie?: string;
};

/**
 * Hiérarchie ROME : grand domaine (1 lettre) → domaine pro (3 chars) → métier (5 chars).
 * Imbriquée dans la réponse API sous `domaineProfessionnel`.
 */
export type RomeDomaineProfessionnel = {
  code?: string;
  libelle?: string;
  grandDomaine?: {
    code?: string;
    libelle?: string;
  };
};

/**
 * Détails complets d'un métier (endpoint single-fetch).
 *
 * Reflète la structure réelle de l'API observée en mai 2025 :
 *  - les codes domaines sont imbriqués dans `domaineProfessionnel`
 *  - les compétences sont dans `competencesMobilisees*` (pas `competencesDeBase`)
 *  - `accesEmploi` décrit les formations / niveau requis
 */
export type RomeMetierDetails = {
  code: string;
  libelle: string;
  definition?: string;
  /** Texte libre décrivant le niveau de formation requis. */
  accesEmploi?: string;

  /** Hiérarchie domaine — source des codes pour le matching. */
  domaineProfessionnel?: RomeDomaineProfessionnel;

  /** Compétences principales (≈ 10 items) — orientées action / savoir-faire. */
  competencesMobiliseesPrincipales?: RomeCompetence[];
  /** Toutes les compétences (≈ 40-50 items) — savoirs + savoir-faire mélangés. */
  competencesMobilisees?: RomeCompetence[];

  contextesTravail?: RomeContexteTravail[];
};
