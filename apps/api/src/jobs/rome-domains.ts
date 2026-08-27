/**
 * Référentiel des 14 grands domaines ROME (codes A → N).
 *
 * Source de vérité unique côté back : on y attache un `slug` d'URL stable et un
 * `label` d'affichage propres (les libellés officiels France Travail sont longs
 * et pas idéaux pour une URL), plus une courte intro éditoriale — contenu unique
 * qui donne de la matière SEO aux pages piliers `/metiers/domaine/<slug>`.
 *
 * La jointure avec les métiers se fait sur `RomeJob.codeGrandDomaine` (la lettre
 * A → N). Un métier dont le grand domaine est absent de cette table n'apparaît
 * dans aucun pilier (il reste listé dans l'annuaire A–Z `/metiers`).
 */
export type RomeGrandDomain = {
  /** Code ROME du grand domaine : une lettre A → N. */
  code: string;
  /** Slug d'URL stable (kebab-case, sans accent). */
  slug: string;
  /** Libellé d'affichage. */
  label: string;
  /** Paragraphe d'introduction (contenu SEO unique du pilier). */
  intro: string;
};

export const ROME_GRAND_DOMAINS: readonly RomeGrandDomain[] = [
  {
    code: 'A',
    slug: 'agriculture-nature-animaux',
    label: 'Agriculture, nature et animaux',
    intro:
      "Cultiver, élever, entretenir les espaces naturels ou prendre soin des animaux : les métiers de ce domaine se vivent surtout dehors, au rythme du vivant. Ils vont de l'exploitation agricole au paysagisme, en passant par les soins animaliers et la protection de l'environnement.",
  },
  {
    code: 'B',
    slug: 'artisanat-metiers-art',
    label: "Artisanat et métiers d'art",
    intro:
      "Travailler la matière avec ses mains pour créer des pièces uniques : bijoux, céramique, cuir, textile, restauration d'œuvres. Ces métiers d'art allient savoir-faire technique et sensibilité esthétique, souvent au sein de petits ateliers.",
  },
  {
    code: 'C',
    slug: 'banque-assurance-immobilier',
    label: 'Banque, assurance et immobilier',
    intro:
      "Conseiller, gérer des risques, financer des projets ou vendre des biens : ce domaine réunit les métiers de la finance de proximité, de l'assurance et de l'immobilier. Le contact client et la rigueur y sont centraux.",
  },
  {
    code: 'D',
    slug: 'commerce-vente',
    label: 'Commerce, vente et distribution',
    intro:
      "De la vente en boutique au commerce en ligne, de la grande distribution au négoce : ces métiers font le lien entre les produits et les clients. Sens du contact, goût du résultat et connaissance produit y sont déterminants.",
  },
  {
    code: 'E',
    slug: 'communication-medias-multimedia',
    label: 'Communication, médias et multimédia',
    intro:
      "Informer, créer, diffuser : journalisme, édition, publicité, production audiovisuelle et création numérique. Ce domaine attire les profils créatifs à l'aise avec le message, l'image et les outils digitaux.",
  },
  {
    code: 'F',
    slug: 'construction-batiment-travaux-publics',
    label: 'Construction, bâtiment et travaux publics',
    intro:
      "Bâtir, rénover, aménager le territoire : du gros œuvre aux finitions, de la conduite de chantier aux travaux publics. Des métiers concrets, souvent manuels, avec de forts besoins de recrutement.",
  },
  {
    code: 'G',
    slug: 'hotellerie-restauration-tourisme',
    label: 'Hôtellerie, restauration et tourisme',
    intro:
      "Accueillir, servir, faire vivre une expérience : cuisine, salle, hébergement, tourisme, loisirs et animation. Un domaine dynamique, tourné vers le client, où le sens du service et l'énergie priment.",
  },
  {
    code: 'H',
    slug: 'industrie',
    label: 'Industrie',
    intro:
      "Concevoir, produire et contrôler à l'échelle industrielle : mécanique, électronique, chimie, agroalimentaire, méthodes et qualité. Des métiers techniques, de plus en plus automatisés, au cœur de la production française.",
  },
  {
    code: 'I',
    slug: 'installation-maintenance',
    label: 'Installation et maintenance',
    intro:
      "Installer, dépanner, entretenir les équipements pour qu'ils fonctionnent sans interruption : du matériel industriel aux systèmes du quotidien. Autonomie, diagnostic et débrouillardise sont la marque de ces métiers.",
  },
  {
    code: 'J',
    slug: 'sante',
    label: 'Santé',
    intro:
      "Soigner, accompagner, prévenir : médecine, soins infirmiers, rééducation, pharmacie et professions paramédicales. Un domaine porteur de sens, exigeant, avec des besoins qui ne cessent de croître.",
  },
  {
    code: 'K',
    slug: 'services-a-la-personne-collectivite',
    label: 'Services à la personne et à la collectivité',
    intro:
      "Aider, éduquer, protéger, rendre service : travail social, petite enfance, aide à domicile, enseignement, sécurité et services publics. Des métiers de contact humain, au service des autres et de la collectivité.",
  },
  {
    code: 'L',
    slug: 'spectacle-arts-vivants',
    label: 'Spectacle et arts vivants',
    intro:
      "Créer et porter le spectacle : musique, danse, théâtre, cinéma, ainsi que tous les métiers techniques qui les rendent possibles (lumière, son, régie). Passion, exigence artistique et statuts spécifiques caractérisent ce domaine.",
  },
  {
    code: 'M',
    slug: 'support-entreprise',
    label: "Support à l'entreprise",
    intro:
      "Faire tourner l'entreprise de l'intérieur : informatique, ressources humaines, comptabilité, gestion, marketing, direction et conseil. Un vaste domaine de métiers tertiaires, souvent au bureau, où l'informatique tient une place grandissante.",
  },
  {
    code: 'N',
    slug: 'transport-logistique',
    label: 'Transport et logistique',
    intro:
      "Déplacer les marchandises et les personnes, organiser les flux : conduite, entreposage, supply chain, transport aérien, maritime ou routier. Des métiers essentiels, cadencés, avec de nombreux débouchés.",
  },
] as const;

const BY_CODE = new Map(ROME_GRAND_DOMAINS.map((d) => [d.code, d]));
const BY_SLUG = new Map(ROME_GRAND_DOMAINS.map((d) => [d.slug, d]));

/** Retourne le grand domaine par son code ROME (A → N), ou undefined. */
export function romeDomainByCode(code: string | null | undefined) {
  return code ? BY_CODE.get(code) : undefined;
}

/** Retourne le grand domaine par son slug d'URL, ou undefined. */
export function romeDomainBySlug(slug: string) {
  return BY_SLUG.get(slug);
}
