import { saveSession, type StoredSession } from "./storage";

const DEV_SESSION: Omit<StoredSession, "savedAt"> = {
  sessionId: "dev-seed-session",
  answers: {
    situation: "actif",
    metier_actuel: "Chef de projet marketing digital",
    ce_qui_pese: "Les réunions sans fin et les KPIs déconnectés du terrain",
    ce_qui_garde: "La créativité et le contact avec les équipes produit",
    competences_recues: "Gestion de projet, copywriting, analyse de données",
    formation_acceptable: "6_mois",
    salaire_floor: "35k",
    cadre_travail: "hybride",
    manuel_bureau: "bureau",
    contact_humain: "equipe_petite",
    valeur_cle: "impact",
    mobilite: "non",
    rythme: "regulier",
    journee_ideale: "Mélange de conception solitaire et d'ateliers en équipe restreinte",
    irritants: "Bureaucratie, reporting sans fin, décisions prises sans les équipes terrain",
    fascination: "L'intersection entre psychologie comportementale et design de produit",
  },
  portrait: {
    archetype: "L'Architecte du lien",
    summary:
      "Tu as construit au fil des années une capacité rare : relier les gens et les idées " +
      "avec une rigueur que peu possèdent. Tu sais quand accélérer et quand prendre du recul " +
      "— c'est ce qui te rend précieux dans une équipe.",
    strengths: ["Structuration claire", "Écoute stratégique", "Passage à l'action"],
    thrives:
      "Orchestrer des projets transverses où tu vois l'impact direct sur les personnes impliquées",
    drains:
      "Les environnements où les décisions sont noyées dans les niveaux hiérarchiques sans fin",
  },
  matches: [
    {
      job: {
        // Slug = code ROME réel (le seed doit pointer vers un métier présent en
        // base, sinon la fiche /metiers/[slug] renvoie 404).
        slug: "E1104",
        title: "Concepteur de contenus multimédia",
        tagline: "Donner vie à des produits numériques utiles",
        summary:
          "Tu travailles à l'intersection du design, de la technique et du business pour " +
          "définir et faire évoluer un produit digital. Tu priorises les fonctionnalités, " +
          "testes des hypothèses et coordonnes les équipes autour d'une vision commune.",
        missions: [
          "Définir la roadmap produit avec les équipes design et tech",
          "Analyser les retours utilisateurs et les données d'usage",
          "Rédiger les spécifications fonctionnelles",
          "Animer les rituels agile (sprint planning, rétros)",
        ],
        skills: ["Product management", "UX thinking", "Data analyse", "Communication"],
        formations: ["Master management digital", "Bootcamp Product Manager", "Autodidacte + certif"],
        salaryRangeHint: "35 000 – 55 000 € brut/an",
        workContext: "Startups, scale-ups, équipes produit en ETI",
      },
      score: 91,
      scorePercent: 91,
      rationale:
        "Ton parcours marketing digital t'a déjà exposé aux produits numériques. La transition " +
        "vers le product management s'appuie sur des compétences que tu as déjà — analyse, " +
        "coordination, vision utilisateur — et t'éloigne du reporting sans fin que tu décris.",
    },
    {
      job: {
        slug: "M1402",
        title: "Responsable en organisation en entreprise",
        tagline: "Comprendre les utilisateurs pour mieux les servir",
        summary:
          "Tu mènes des recherches qualitatives et quantitatives pour comprendre les besoins, " +
          "comportements et douleurs des utilisateurs. Tes insights alimentent les décisions " +
          "de design et de product.",
        missions: [
          "Planifier et conduire des entretiens utilisateurs",
          "Analyser les données comportementales (heatmaps, recordings)",
          "Produire des livrables actionnables (personas, journey maps)",
          "Présenter les insights aux équipes produit et design",
        ],
        skills: ["Recherche qualitative", "Tests utilisateurs", "Analyse statistique", "Storytelling"],
        formations: ["Master psychologie / sciences cognitives", "Formation UX Research (Nielsen Norman)", "Reconversion via bootcamp"],
        salaryRangeHint: "38 000 – 52 000 € brut/an",
        workContext: "Grandes entreprises tech, agences UX, freelance",
      },
      score: 84,
      scorePercent: 84,
      rationale:
        "Ta fascination pour la psychologie comportementale que tu mentionnes correspond " +
        "exactement à ce qu'on fait en UX Research. Tu passerais ta journée à comprendre " +
        "les gens — sans la pression des KPIs marketing.",
    },
    {
      job: {
        slug: "M1707",
        title: "Responsable du développement commercial",
        tagline: "Accompagner les organisations dans leur évolution numérique",
        summary:
          "Tu accompagnes des entreprises à moderniser leurs processus, adopter de nouveaux " +
          "outils et faire évoluer leur culture. Tu travailles à la fois sur le diagnostic, " +
          "la stratégie et la conduite du changement.",
        missions: [
          "Auditer les processus existants et identifier les points de friction",
          "Proposer et prioriser des plans de transformation",
          "Former et accompagner les équipes dans l'adoption",
          "Suivre les indicateurs de changement",
        ],
        skills: ["Conseil", "Gestion du changement", "Communication", "Méthodes agile"],
        formations: ["École de commerce", "Master management", "Expérience terrain valorisée"],
        salaryRangeHint: "40 000 – 65 000 € brut/an (+ variable)",
        workContext: "Cabinets de conseil, ESN, freelance senior",
      },
      score: 77,
      scorePercent: 77,
      rationale:
        "Ton expérience en gestion de projet et ta maîtrise des outils digitaux sont des " +
        "atouts directs. L'aspect 'lien entre les équipes terrain et la direction' que tu " +
        "cherches se retrouve exactement dans ce rôle.",
    },
  ],
  hasEmail: true,
  ratings: {},
  refinedMatches: null,
  refineInsight: null,
  batches: [],
};

/** Injecte une session de démo dans sessionStorage. Dev uniquement. */
export function seedDevSession(): void {
  if (process.env.NODE_ENV !== "development") return;
  saveSession(DEV_SESSION);
}
