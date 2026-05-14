import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Seed v3 — Questionnaire dual-track.
 *
 * Deux parcours distincts selon la situation de l'utilisateur :
 *
 *   Track A (étudiant) : lycee | etudes_longues
 *     → Questions sur les passions, rêves, style d'apprentissage,
 *       vision de vie. Signal IA basé sur le potentiel.
 *
 *   Track B (actif/reconversion) : actif | reconversion
 *     → Questions sur le job actuel, ce qui pèse, compétences acquises,
 *       contraintes réelles. Signal IA basé sur l'expérience.
 *
 *   Communes : valeurs, environnement, contact humain, mobilité, etc.
 *
 * Conditions disponibles sur chaque question :
 *   askIfEquals    { key: "value" }         — réponse exacte
 *   askIfNotEquals { key: "value" }         — réponse différente
 *   askIfIn        { key: ["v1","v2"] }     — réponse dans le tableau
 *   askIfNotIn     { key: ["v1","v2"] }     — réponse hors du tableau
 *
 * Format des `domainWeights` : { "M": 3, "J": 2, ... }
 * Codes grand domaine ROME :
 *   A — Agriculture, espaces naturels, soins aux animaux
 *   B — Arts et façonnage d'ouvrages d'art
 *   C — Banque, assurance, immobilier
 *   D — Commerce, vente, grande distribution
 *   E — Communication, média, multimédia
 *   F — Construction, BTP
 *   G — Hôtellerie-restauration, tourisme, animation
 *   H — Industrie
 *   I — Installation, maintenance
 *   J — Santé
 *   K — Services à la personne et à la collectivité
 *   L — Spectacle
 *   M — Support à l'entreprise (IT, RH, finance, conseil…)
 *   N — Transport, logistique
 *
 * Codes sous-domaine à 3 chars pour précision accrue :
 *   M18 — Systèmes d'information et télécommunications (IT, dev, data)
 *   M11 — Comptabilité et gestion
 *   M13 — Conseil et maîtrise d'ouvrage SI
 *
 * Les questions texte libre (FREE_TEXT) n'ont pas de domainWeights :
 * leur signal est qualitatif et traité exclusivement par le reranking IA.
 */

type SeedQuestion = {
  key: string;
  text: string;
  orderHint: number;
  type?: 'SINGLE_CHOICE' | 'FREE_TEXT' | 'SUGGESTIONS_WITH_TEXT';
  placeholder?: string;
  helperText?: string;
  askIfEquals?: Record<string, string>;
  askIfNotEquals?: Record<string, string>;
  askIfIn?: Record<string, string[]>;
  askIfNotIn?: Record<string, string[]>;
  options: Array<{
    key: string;
    label: string;
    jobWeights: Record<string, number>;
    domainWeights: Record<string, number>;
  }>;
};

const QUESTIONS: SeedQuestion[] = [

  // ══════════════════════════════════════════════════════════════════════
  // QUESTION INITIALE — commune à tous
  // ══════════════════════════════════════════════════════════════════════

  {
    key: 'situation',
    text: 'Pour commencer — quelle est ta situation actuelle ?',
    orderHint: 1,
    options: [
      {
        key: 'lycee',
        label: 'Au lycée ou en études courtes (CAP, BTS…)',
        jobWeights: {},
        domainWeights: {},
      },
      {
        key: 'etudes_longues',
        label: 'En études longues (Bac+3 et plus)',
        jobWeights: {},
        domainWeights: {},
      },
      {
        key: 'actif',
        label: 'En poste — j\'explore de nouvelles pistes',
        jobWeights: {},
        domainWeights: {},
      },
      {
        key: 'reconversion',
        label: 'Je veux changer de métier, je ne sais pas encore vers quoi',
        jobWeights: {},
        domainWeights: {},
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  // TRACK A — Étudiant (lycee | etudes_longues)
  // Objectif : capter les passions, le potentiel et la vision de vie.
  // Les questions texte libre alimentent directement le reranking IA.
  // ══════════════════════════════════════════════════════════════════════

  {
    key: 'passion_centrale',
    text: 'Quelle matière, activité ou sujet te fascine au point d\'y passer des heures sans t\'en rendre compte ?',
    orderHint: 10,
    type: 'SUGGESTIONS_WITH_TEXT',
    placeholder: 'Précise ou décris ce qui t\'attire dans ce domaine…',
    helperText: 'Pas besoin que ce soit un sujet scolaire — tes passions hors classe comptent autant.',
    askIfIn: { situation: ['lycee', 'etudes_longues'] },
    options: [
      { key: 'tech_code', label: 'Technologie & code', jobWeights: {}, domainWeights: { M18: 3 } },
      { key: 'sciences', label: 'Sciences & recherche', jobWeights: {}, domainWeights: { J: 2, M: 1 } },
      { key: 'art_design', label: 'Art & design', jobWeights: {}, domainWeights: { B: 3, E: 2 } },
      { key: 'musique_son', label: 'Musique & son', jobWeights: {}, domainWeights: { L: 4 } },
      { key: 'ecriture_langues', label: 'Écriture & langues', jobWeights: {}, domainWeights: { E: 3, B: 1 } },
      { key: 'sport_mouvement', label: 'Sport & mouvement', jobWeights: {}, domainWeights: { G: 2, K: 2 } },
      { key: 'nature_environnement', label: 'Nature & environnement', jobWeights: {}, domainWeights: { A: 4 } },
      { key: 'psychologie_humain', label: 'Psychologie & relations humaines', jobWeights: {}, domainWeights: { J: 2, K: 3 } },
      { key: 'entrepreneuriat', label: 'Entrepreneuriat & business', jobWeights: {}, domainWeights: { M: 3, D: 2 } },
      { key: 'cuisine_gastronomie', label: 'Cuisine & gastronomie', jobWeights: {}, domainWeights: { G: 3 } },
      { key: 'jeux_video', label: 'Jeux vidéo & univers virtuels', jobWeights: {}, domainWeights: { M18: 2, E: 2 } },
      { key: 'histoire_culture', label: 'Histoire & culture', jobWeights: {}, domainWeights: { E: 2, K: 1 } },
    ],
  },

  {
    key: 'metier_immersion',
    text: 'Si tu pouvais passer une semaine en immersion dans un métier, sans conséquences, ce serait lequel et pourquoi ?',
    orderHint: 11,
    type: 'SUGGESTIONS_WITH_TEXT',
    placeholder: 'Dis pourquoi ce métier t\'attire vraiment…',
    helperText: 'L\'idéal n\'est pas de répondre "ce qui est réaliste" mais ce qui t\'attire vraiment.',
    askIfIn: { situation: ['lycee', 'etudes_longues'] },
    options: [
      { key: 'medecin_chirurgien', label: 'Médecin / chirurgien', jobWeights: {}, domainWeights: { J: 4 } },
      { key: 'entrepreneur', label: 'Entrepreneur / fondateur', jobWeights: {}, domainWeights: { M: 3, D: 2 } },
      { key: 'architecte', label: 'Architecte', jobWeights: {}, domainWeights: { F: 3, B: 2 } },
      { key: 'realisateur_createur', label: 'Réalisateur / créateur de contenu', jobWeights: {}, domainWeights: { L: 3, E: 3 } },
      { key: 'chercheur_scientifique', label: 'Chercheur / scientifique', jobWeights: {}, domainWeights: { J: 2, M: 2 } },
      { key: 'enseignant_formateur', label: 'Enseignant / formateur', jobWeights: {}, domainWeights: { K: 3 } },
      { key: 'journaliste_auteur', label: 'Journaliste / auteur', jobWeights: {}, domainWeights: { E: 4 } },
      { key: 'ingenieur', label: 'Ingénieur', jobWeights: {}, domainWeights: { M18: 2, H: 2, F: 1 } },
      { key: 'avocat_juriste', label: 'Avocat / juriste', jobWeights: {}, domainWeights: { M: 3, C: 2 } },
      { key: 'psychologue_therapeute', label: 'Psychologue / thérapeute', jobWeights: {}, domainWeights: { J: 3, K: 2 } },
      { key: 'chef_cuisinier', label: 'Chef cuisinier', jobWeights: {}, domainWeights: { G: 4 } },
      { key: 'veterinaire', label: 'Vétérinaire', jobWeights: {}, domainWeights: { A: 3, J: 1 } },
    ],
  },

  {
    key: 'vision_10ans',
    text: 'Quand tu imagines ta vie professionnelle dans 10 ans, ce qui compte le plus c\'est…',
    orderHint: 12,
    askIfIn: { situation: ['lycee', 'etudes_longues'] },
    options: [
      {
        key: 'impact_sens',
        label: 'Avoir un impact concret sur les gens ou l\'environnement',
        jobWeights: {},
        domainWeights: { J: 3, K: 3, A: 2, E: 1 },
      },
      {
        key: 'creer_innover',
        label: 'Créer ou innover — lancer quelque chose qui m\'appartient',
        jobWeights: {},
        domainWeights: { M: 3, D: 2, E: 2, B: 2 },
      },
      {
        key: 'expertise_reconnue',
        label: 'Être reconnu·e comme expert·e dans mon domaine',
        jobWeights: {},
        domainWeights: { J: 3, M: 3, C: 2 },
      },
      {
        key: 'vie_equilibree',
        label: 'Une vie équilibrée, du temps pour moi et les miens',
        jobWeights: {},
        domainWeights: { K: 3, A: 2, G: 2, J: 1 },
      },
      {
        key: 'progresser_vite',
        label: 'Gagner bien ma vie et progresser vite',
        jobWeights: {},
        domainWeights: { M: 4, C: 3, D: 2 },
      },
    ],
  },

  {
    key: 'style_apprentissage',
    text: 'Le cadre scolaire ou académique te…',
    orderHint: 13,
    askIfIn: { situation: ['lycee', 'etudes_longues'] },
    options: [
      {
        key: 'epanouit',
        label: 'Épanouit — j\'aime les cours, les exposés, les projets de groupe',
        jobWeights: {},
        domainWeights: { J: 2, M: 2, C: 2, K: 1 },
      },
      {
        key: 'etouffe',
        label: 'Étouffe — je préfère apprendre en faisant, pas en écoutant',
        jobWeights: {},
        domainWeights: { F: 3, H: 3, I: 3, G: 2, A: 2 },
      },
      {
        key: 'depend_sujet',
        label: 'Dépend du sujet — certains me passionnent, d\'autres m\'ennuient',
        jobWeights: {},
        domainWeights: { E: 2, B: 2, D: 1, L: 1 },
      },
      {
        key: 'autodidacte',
        label: 'Ne me correspond pas — je suis plutôt autodidacte',
        jobWeights: {},
        domainWeights: { M18: 3, E: 3, B: 2, L: 2 },
      },
    ],
  },

  {
    key: 'role_groupe',
    text: 'En groupe ou en équipe, tu es naturellement le type à…',
    orderHint: 14,
    askIfIn: { situation: ['lycee', 'etudes_longues'] },
    options: [
      {
        key: 'lancer_idees',
        label: 'Lancer des idées et convaincre le groupe',
        jobWeights: {},
        domainWeights: { E: 3, D: 3, M: 2 },
      },
      {
        key: 'realiser',
        label: 'Concrétiser et faire aboutir les projets',
        jobWeights: {},
        domainWeights: { M: 3, F: 2, H: 2, I: 2 },
      },
      {
        key: 'organiser',
        label: 'Organiser, clarifier les rôles, éviter le flou',
        jobWeights: {},
        domainWeights: { M: 3, C: 3, N: 1 },
      },
      {
        key: 'analyser',
        label: 'Analyser, challenger les idées avant d\'agir',
        jobWeights: {},
        domainWeights: { M: 3, C: 3, J: 1 },
      },
      {
        key: 'prendre_soin',
        label: 'T\'assurer que tout le monde va bien et que l\'ambiance est bonne',
        jobWeights: {},
        domainWeights: { K: 4, J: 3, G: 2 },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  // TRACK B — Actif / Reconversion (actif | reconversion)
  // Objectif : analyser l'expérience réelle, ce qui pèse et les forces.
  // Toutes les questions texte libre ici sont les plus riches pour l'IA.
  // ══════════════════════════════════════════════════════════════════════

  {
    key: 'metier_actuel',
    text: 'Ton métier ou secteur actuel, c\'est quoi ? Décris ce que tu fais vraiment au quotidien.',
    orderHint: 10,
    type: 'SUGGESTIONS_WITH_TEXT',
    placeholder: 'Décris ce que tu fais vraiment au quotidien, pas juste ton titre…',
    helperText: 'Pas ton titre officiel — ce que tu fais vraiment, jour après jour.',
    askIfIn: { situation: ['actif', 'reconversion'] },
    options: [
      { key: 'commercial_vente', label: 'Commercial / vente', jobWeights: {}, domainWeights: { D: 4 } },
      { key: 'marketing_comm', label: 'Marketing & communication', jobWeights: {}, domainWeights: { E: 3, D: 2 } },
      { key: 'informatique_tech', label: 'Informatique / tech', jobWeights: {}, domainWeights: { M18: 4 } },
      { key: 'finance_compta', label: 'Finance & comptabilité', jobWeights: {}, domainWeights: { M11: 4, C: 2 } },
      { key: 'rh', label: 'Ressources humaines', jobWeights: {}, domainWeights: { M: 3, K: 1 } },
      { key: 'management_projet', label: 'Management / gestion de projet', jobWeights: {}, domainWeights: { M: 3 } },
      { key: 'sante_medical', label: 'Santé / médical', jobWeights: {}, domainWeights: { J: 4 } },
      { key: 'enseignement_formation', label: 'Enseignement / formation', jobWeights: {}, domainWeights: { K: 3 } },
      { key: 'artisanat_technique', label: 'Artisanat / technique', jobWeights: {}, domainWeights: { F: 3, I: 3, H: 2 } },
      { key: 'logistique_transport', label: 'Logistique / transport', jobWeights: {}, domainWeights: { N: 4 } },
      { key: 'conseil_consulting', label: 'Conseil / consulting', jobWeights: {}, domainWeights: { M13: 3, M: 2 } },
      { key: 'administratif', label: 'Administratif / back-office', jobWeights: {}, domainWeights: { M: 2, C: 2 } },
    ],
  },

  {
    key: 'ce_qui_pese',
    text: 'Qu\'est-ce qui te pèse le plus dans ton travail en ce moment ? Sois honnête.',
    orderHint: 11,
    type: 'SUGGESTIONS_WITH_TEXT',
    placeholder: 'Tu peux préciser ou donner des exemples concrets…',
    helperText: 'Ce que tu dis ici aide à éviter de te retrouver dans le même piège avec un autre métier.',
    askIfIn: { situation: ['actif', 'reconversion'] },
    options: [
      { key: 'manque_sens', label: 'Manque de sens', jobWeights: {}, domainWeights: {} },
      { key: 'pas_evolution', label: 'Pas d\'évolution possible', jobWeights: {}, domainWeights: {} },
      { key: 'manager_difficile', label: 'Manager difficile', jobWeights: {}, domainWeights: {} },
      { key: 'taches_repetitives', label: 'Tâches répétitives', jobWeights: {}, domainWeights: {} },
      { key: 'surcharge', label: 'Surcharge de travail', jobWeights: {}, domainWeights: {} },
      { key: 'mauvaise_ambiance', label: 'Mauvaise ambiance d\'équipe', jobWeights: {}, domainWeights: {} },
      { key: 'manque_autonomie', label: 'Manque d\'autonomie', jobWeights: {}, domainWeights: {} },
      { key: 'remuneration', label: 'Rémunération insuffisante', jobWeights: {}, domainWeights: {} },
      { key: 'pas_creativite', label: 'Pas de créativité', jobWeights: {}, domainWeights: {} },
      { key: 'bureaucratie', label: 'Trop de bureaucratie', jobWeights: {}, domainWeights: {} },
    ],
  },

  {
    key: 'ce_qui_garde',
    text: 'Si tu pouvais garder 2-3 choses de ton job actuel et changer tout le reste — tu garderais quoi ?',
    orderHint: 12,
    type: 'SUGGESTIONS_WITH_TEXT',
    placeholder: 'Tu peux préciser ce qui rend ces éléments importants pour toi…',
    helperText: 'Ces éléments sont le fil conducteur de ta reconversion idéale.',
    askIfIn: { situation: ['actif', 'reconversion'] },
    options: [
      { key: 'contact_clients', label: 'Contact avec les clients / usagers', jobWeights: {}, domainWeights: { D: 2, G: 2, J: 1 } },
      { key: 'autonomie', label: 'Autonomie dans mon travail', jobWeights: {}, domainWeights: { M: 2, B: 1 } },
      { key: 'creativite', label: 'La créativité', jobWeights: {}, domainWeights: { B: 3, E: 2 } },
      { key: 'variete_taches', label: 'La variété des tâches', jobWeights: {}, domainWeights: { M: 2, G: 1 } },
      { key: 'impact_concret', label: 'L\'impact concret de mon travail', jobWeights: {}, domainWeights: { J: 2, K: 2 } },
      { key: 'travail_equipe', label: 'Le travail en équipe', jobWeights: {}, domainWeights: { M: 1, F: 1 } },
      { key: 'expertise_technique', label: 'Mon expertise technique', jobWeights: {}, domainWeights: { M18: 2, H: 2 } },
      { key: 'liberte_organisation', label: 'La liberté d\'organisation', jobWeights: {}, domainWeights: { M: 2, E: 1 } },
      { key: 'projets_transverses', label: 'Les projets transverses / polyvalence', jobWeights: {}, domainWeights: { M: 2 } },
      { key: 'relation_collegues', label: 'La relation avec mes collègues', jobWeights: {}, domainWeights: {} },
    ],
  },

  {
    key: 'competences_recues',
    text: 'Tes collègues, amis ou famille — pour quoi viennent-ils naturellement te demander de l\'aide ?',
    orderHint: 13,
    type: 'SUGGESTIONS_WITH_TEXT',
    placeholder: 'Donne un exemple concret si tu veux…',
    helperText: 'Ces forces naturelles sont souvent invisibles pour toi, mais précieuses dans une reconversion.',
    askIfIn: { situation: ['actif', 'reconversion'] },
    options: [
      { key: 'resoudre_conflits', label: 'Résoudre des conflits', jobWeights: {}, domainWeights: { K: 3, J: 1 } },
      { key: 'organiser_planifier', label: 'Organiser & planifier', jobWeights: {}, domainWeights: { M: 3, N: 1 } },
      { key: 'expliquer_enseigner', label: 'Expliquer & enseigner', jobWeights: {}, domainWeights: { K: 3, E: 1 } },
      { key: 'analyser_donnees', label: 'Analyser des données / situations', jobWeights: {}, domainWeights: { M: 3, C: 2 } },
      { key: 'convaincre_negocier', label: 'Convaincre & négocier', jobWeights: {}, domainWeights: { D: 3, M: 2 } },
      { key: 'creer_concevoir', label: 'Créer & concevoir', jobWeights: {}, domainWeights: { B: 3, E: 2 } },
      { key: 'reparer_construire', label: 'Réparer & construire', jobWeights: {}, domainWeights: { I: 3, F: 3, H: 2 } },
      { key: 'ecouter_conseiller', label: 'Écouter & conseiller', jobWeights: {}, domainWeights: { J: 2, K: 3 } },
      { key: 'gerer_budgets', label: 'Gérer des budgets', jobWeights: {}, domainWeights: { M11: 3, C: 2 } },
      { key: 'decisions_pression', label: 'Décider sous pression', jobWeights: {}, domainWeights: { J: 2, M: 2, N: 1 } },
    ],
  },

  {
    key: 'formation_acceptable',
    text: 'Pour cette reconversion, tu es prêt·e à…',
    orderHint: 14,
    askIfIn: { situation: ['actif', 'reconversion'] },
    options: [
      {
        key: 'longue_si_necessaire',
        label: 'Une formation longue (1-2 ans) si c\'est vraiment nécessaire',
        jobWeights: {},
        domainWeights: { J: 3, M: 2, C: 2, E: 1 },
      },
      {
        key: 'courte_certif',
        label: 'Une formation courte (6 mois max) ou une certification',
        jobWeights: {},
        domainWeights: { I: 2, D: 2, F: 2, H: 2, M: 1 },
      },
      {
        key: 'terrain_pratique',
        label: 'Apprendre sur le terrain — je préfère l\'immersion à la théorie',
        jobWeights: {},
        domainWeights: { G: 3, A: 2, N: 2, D: 1, F: 1 },
      },
      {
        key: 'sans_formation',
        label: 'Valoriser mes compétences actuelles — pas de formation longue',
        jobWeights: {},
        domainWeights: { M: 2, D: 2, C: 2, E: 1 },
      },
    ],
  },

  {
    key: 'salaire_floor',
    text: 'Niveau salaire en reconversion, tu accepterais…',
    orderHint: 15,
    askIfIn: { situation: ['actif', 'reconversion'] },
    options: [
      {
        key: 'reset_si_sens',
        label: 'Un reset complet si le sens y est — le salaire viendra après',
        jobWeights: {},
        domainWeights: { A: 2, K: 2, J: 1, B: 1, L: 1 },
      },
      {
        key: 'baisse_temporaire',
        label: 'Une baisse temporaire (-20% max) le temps de la transition',
        jobWeights: {},
        domainWeights: { M: 2, D: 2, J: 2, K: 1 },
      },
      {
        key: 'maintenir',
        label: 'Maintenir mon niveau actuel — non négociable',
        jobWeights: {},
        domainWeights: { M: 3, C: 3, D: 2 },
      },
      {
        key: 'augmenter',
        label: 'Profiter de la reconversion pour viser plus haut',
        jobWeights: {},
        domainWeights: { M: 4, C: 3, D: 2 },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  // QUESTIONS COMMUNES — posées à tous (pas de condition)
  // Maintiennent le signal ROME pour le scoring algorithmique.
  // Certaines ont des domainWeights enrichis avec des codes 3-chars
  // pour la précision (ex: M18 = IT, plutôt que tout M).
  // ══════════════════════════════════════════════════════════════════════

  {
    key: 'cadre_travail',
    text: 'Dans quel cadre tu t\'imagines travailler au quotidien ?',
    orderHint: 20,
    options: [
      {
        key: 'dehors_terrain',
        label: 'En extérieur ou sur le terrain — pas de journées identiques',
        jobWeights: {},
        domainWeights: { A: 3, F: 3, N: 2, I: 2 },
      },
      {
        key: 'bureau_ecran',
        label: 'En bureau ou en télétravail, face à un écran',
        jobWeights: {},
        domainWeights: { M: 3, C: 2, E: 2 },
      },
      {
        key: 'face_public',
        label: 'En contact direct avec des clients, patients ou usagers',
        jobWeights: {},
        domainWeights: { D: 3, J: 3, G: 2, K: 2 },
      },
      {
        key: 'atelier_labo',
        label: 'En atelier, laboratoire ou studio — un espace dédié',
        jobWeights: {},
        domainWeights: { H: 3, B: 3, I: 2, J: 1 },
      },
    ],
  },

  {
    key: 'manuel_bureau',
    text: 'Tu te vois plutôt…',
    orderHint: 21,
    options: [
      {
        key: 'tres_manuel',
        label: 'Travailler de mes mains — construire, réparer, fabriquer',
        jobWeights: {},
        domainWeights: { F: 4, I: 4, H: 3, B: 2, A: 2 },
      },
      {
        key: 'mixte',
        label: 'Mélanger action physique et réflexion',
        jobWeights: {},
        domainWeights: { G: 2, D: 2, K: 2, J: 2, N: 2 },
      },
      {
        key: 'intellectuel',
        label: 'Analyser, réfléchir, résoudre des problèmes complexes',
        jobWeights: {},
        domainWeights: { M: 4, C: 3, E: 2 },
      },
      {
        key: 'creatif_expression',
        label: 'Créer et exprimer — dessin, texte, son, image…',
        jobWeights: {},
        domainWeights: { B: 4, L: 4, E: 3 },
      },
    ],
  },

  {
    key: 'contact_humain',
    text: 'Ton rapport idéal aux autres dans le travail…',
    orderHint: 22,
    options: [
      {
        key: 'beaucoup_monde',
        label: 'Beaucoup de monde — clients, public, patients au quotidien',
        jobWeights: {},
        domainWeights: { D: 3, G: 3, J: 3, K: 3 },
      },
      {
        key: 'equipe_soudee',
        label: 'Une équipe soudée avec qui je construis quelque chose',
        jobWeights: {},
        domainWeights: { M: 2, F: 2, H: 2, E: 2 },
      },
      {
        key: 'peu_monde',
        label: 'Peu de monde — concentration et autonomie avant tout',
        jobWeights: {},
        domainWeights: { A: 3, B: 3, M: 2 },
      },
      {
        key: 'variable',
        label: 'Variable — parfois seul, parfois en réunion ou sur le terrain',
        jobWeights: {},
        domainWeights: { N: 2, C: 2, I: 2, K: 1 },
      },
    ],
  },

  {
    key: 'valeur_cle',
    text: 'Ce qui compte le plus pour toi dans un métier…',
    orderHint: 23,
    helperText: 'Si tu ne devais retenir qu\'une chose.',
    options: [
      {
        key: 'impact_sens',
        label: 'Un impact concret sur les gens ou sur l\'environnement',
        jobWeights: {},
        domainWeights: { J: 3, K: 3, A: 2, E: 1 },
      },
      {
        key: 'evolution_salaire',
        label: 'Être bien payé et évoluer vite',
        jobWeights: {},
        domainWeights: { M: 4, C: 3, D: 2 },
      },
      {
        key: 'creativite_liberte',
        label: 'Liberté, créativité — faire les choses à ma façon',
        jobWeights: {},
        domainWeights: { B: 3, E: 3, L: 3, A: 1 },
      },
      {
        key: 'securite_stabilite',
        label: 'Sécurité d\'emploi, un cadre solide et prévisible',
        jobWeights: {},
        domainWeights: { K: 3, J: 2, C: 2, M: 1 },
      },
      {
        key: 'apprendre_innover',
        label: 'Apprendre en permanence, ne jamais faire deux fois la même chose',
        jobWeights: {},
        domainWeights: { M: 3, J: 2, I: 2, F: 1 },
      },
    ],
  },

  {
    key: 'mobilite',
    text: 'Ta mobilité géographique…',
    orderHint: 24,
    options: [
      {
        key: 'ancre_local',
        label: 'Je veux rester dans ma région — ancrage local important',
        jobWeights: {},
        domainWeights: { K: 2, J: 2, F: 2, I: 2, A: 2 },
      },
      {
        key: 'deplacements_ponctuels',
        label: 'Des déplacements ponctuels OK, mais avec un QG fixe',
        jobWeights: {},
        domainWeights: { D: 2, M: 2, C: 2, G: 1 },
      },
      {
        key: 'tres_mobile',
        label: 'Toujours en mouvement — j\'aime changer d\'environnement',
        jobWeights: {},
        domainWeights: { N: 4, G: 3, D: 2 },
      },
      {
        key: 'international',
        label: 'L\'international m\'attire — voyager ou travailler à l\'étranger',
        jobWeights: {},
        domainWeights: { E: 3, M: 2, G: 2, D: 1 },
      },
    ],
  },

  {
    key: 'rythme',
    text: 'Le rythme professionnel qui te convient…',
    orderHint: 25,
    options: [
      {
        key: 'horaires_fixes',
        label: 'Horaires fixes et prévisibles — je déconnecte le soir',
        jobWeights: {},
        domainWeights: { K: 3, C: 2, H: 2, M: 1 },
      },
      {
        key: 'flexible',
        label: 'Flexible — je gère mon agenda selon mes missions',
        jobWeights: {},
        domainWeights: { M: 3, E: 2, B: 2, D: 1 },
      },
      {
        key: 'intense_sprints',
        label: 'Intense par cycles — je kiffe les deadlines et les sprints',
        jobWeights: {},
        domainWeights: { M: 3, D: 2, E: 2, N: 1 },
      },
      {
        key: 'saisonnier',
        label: 'Saisonnier ou à projets — des pics et des temps calmes',
        jobWeights: {},
        domainWeights: { A: 3, G: 3, L: 2, F: 1 },
      },
    ],
  },

  // ─── Textes libres communs ─────────────────────────────────────────────────
  // Positionnés en fin de questionnaire : l'utilisateur a déjà répondu aux QCM
  // et est plus enclin à développer. Aucun domainWeights — signal 100% IA.

  {
    key: 'journee_ideale',
    text: 'Décris une journée (passée ou imaginée) où tu t\'es senti(e) pleinement à ta place. Que faisais-tu ? Avec qui ? Qu\'est-ce qui la rendait bonne ?',
    orderHint: 30,
    type: 'SUGGESTIONS_WITH_TEXT',
    placeholder: 'Décris cette journée — plus c\'est concret et personnel, mieux c\'est…',
    helperText: '2 à 5 phrases suffisent. Clique sur ce qui résonne, puis précise si tu veux.',
    options: [
      { key: 'en_equipe', label: 'En équipe soudée', jobWeights: {}, domainWeights: { M: 1, F: 1 } },
      { key: 'en_autonomie', label: 'En pleine autonomie', jobWeights: {}, domainWeights: { A: 2, B: 2 } },
      { key: 'contact_gens', label: 'En contact avec des gens', jobWeights: {}, domainWeights: { D: 2, G: 2, J: 2, K: 2 } },
      { key: 'exterieur_terrain', label: 'En extérieur / sur le terrain', jobWeights: {}, domainWeights: { A: 3, F: 2, N: 2 } },
      { key: 'projet_creatif', label: 'Sur un projet créatif', jobWeights: {}, domainWeights: { B: 3, E: 3, L: 3 } },
      { key: 'resoudre_problemes', label: 'En résolvant des problèmes concrets', jobWeights: {}, domainWeights: { M: 2, I: 2, J: 1 } },
      { key: 'apprendre', label: 'En apprenant quelque chose de nouveau', jobWeights: {}, domainWeights: { M: 2, J: 1 } },
      { key: 'aider_quelquun', label: 'En aidant quelqu\'un', jobWeights: {}, domainWeights: { J: 3, K: 3 } },
      { key: 'produire_tangible', label: 'En produisant quelque chose de tangible', jobWeights: {}, domainWeights: { F: 2, H: 2, B: 2 } },
      { key: 'impact_visible', label: 'Avec un impact visible et immédiat', jobWeights: {}, domainWeights: { J: 2, K: 2, D: 1 } },
    ],
  },

  {
    key: 'irritants',
    text: 'À l\'inverse, qu\'est-ce qui te gonfle ou t\'épuise dans un boulot, dans les études ou en groupe ?',
    orderHint: 31,
    type: 'SUGGESTIONS_WITH_TEXT',
    placeholder: 'Tu peux donner des exemples vécus si tu veux…',
    helperText: 'Les choses à éviter en disent autant que celles qu\'on aime.',
    options: [
      { key: 'taches_repetitives', label: 'Tâches répétitives', jobWeights: {}, domainWeights: {} },
      { key: 'reunions_inutiles', label: 'Réunions sans décision', jobWeights: {}, domainWeights: {} },
      { key: 'travail_isole', label: 'Travail isolé', jobWeights: {}, domainWeights: {} },
      { key: 'manque_sens', label: 'Manque de sens', jobWeights: {}, domainWeights: {} },
      { key: 'pression_constante', label: 'Pression constante', jobWeights: {}, domainWeights: {} },
      { key: 'pas_resultats', label: 'Pas de résultats visibles', jobWeights: {}, domainWeights: {} },
      { key: 'micro_management', label: 'Micro-management', jobWeights: {}, domainWeights: {} },
      { key: 'chaos_desorganise', label: 'Chaos et désorganisation', jobWeights: {}, domainWeights: {} },
      { key: 'equipe_forcee', label: 'Travail d\'équipe forcé', jobWeights: {}, domainWeights: {} },
      { key: 'rythme_lent', label: 'Rythme trop lent', jobWeights: {}, domainWeights: {} },
    ],
  },

  {
    key: 'fascination',
    text: 'Un métier, une personne dont tu admires le travail, ou une activité qui te fascine — et pourquoi ?',
    orderHint: 32,
    type: 'SUGGESTIONS_WITH_TEXT',
    placeholder: 'Dis pourquoi ça te fascine — ce qui t\'attire dans ce travail ou cette personne…',
    helperText: 'Même si ce n\'est pas un métier que tu veux faire, explique ce qui t\'attire.',
    options: [
      { key: 'soignant_medecin', label: 'Un médecin / soignant', jobWeights: {}, domainWeights: { J: 3 } },
      { key: 'entrepreneur_createur', label: 'Un entrepreneur / créateur', jobWeights: {}, domainWeights: { M: 2, D: 2 } },
      { key: 'artiste_creatif', label: 'Un artiste / créatif', jobWeights: {}, domainWeights: { B: 3, L: 3, E: 2 } },
      { key: 'enseignant_formateur', label: 'Un enseignant / formateur', jobWeights: {}, domainWeights: { K: 3 } },
      { key: 'ingenieur_dev', label: 'Un ingénieur / développeur', jobWeights: {}, domainWeights: { M18: 3, H: 2 } },
      { key: 'travailleur_social', label: 'Un travailleur social / éducateur', jobWeights: {}, domainWeights: { K: 4 } },
      { key: 'chercheur', label: 'Un chercheur / scientifique', jobWeights: {}, domainWeights: { J: 2, M: 2 } },
      { key: 'chef_cuisinier', label: 'Un chef cuisinier / artisan', jobWeights: {}, domainWeights: { G: 3, B: 2 } },
      { key: 'sportif_pro', label: 'Un sportif professionnel', jobWeights: {}, domainWeights: { G: 2, L: 2 } },
      { key: 'architecte_designer', label: 'Un architecte / designer', jobWeights: {}, domainWeights: { F: 2, B: 3 } },
    ],
  },
];

// ─── Seed ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    // Désactiver toutes les anciennes questions avant de seeder.
    // Les nouvelles seront upsertées avec active: true.
    await prisma.question.updateMany({ data: { active: false } });
    console.log('Anciennes questions désactivées.');

    for (const question of QUESTIONS) {
      const upserted = await prisma.question.upsert({
        where: { key: question.key },
        update: {
          text: question.text,
          orderHint: question.orderHint,
          type: question.type ?? 'SINGLE_CHOICE',
          placeholder: question.placeholder ?? null,
          helperText: question.helperText ?? null,
          askIfEquals: question.askIfEquals
            ? (question.askIfEquals as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          askIfNotEquals: question.askIfNotEquals
            ? (question.askIfNotEquals as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          askIfIn: question.askIfIn
            ? (question.askIfIn as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          askIfNotIn: question.askIfNotIn
            ? (question.askIfNotIn as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          active: true,
        },
        create: {
          key: question.key,
          text: question.text,
          orderHint: question.orderHint,
          type: question.type ?? 'SINGLE_CHOICE',
          placeholder: question.placeholder ?? null,
          helperText: question.helperText ?? null,
          askIfEquals: question.askIfEquals
            ? (question.askIfEquals as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          askIfNotEquals: question.askIfNotEquals
            ? (question.askIfNotEquals as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          askIfIn: question.askIfIn
            ? (question.askIfIn as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          askIfNotIn: question.askIfNotIn
            ? (question.askIfNotIn as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          active: true,
        },
      });

      for (const option of question.options) {
        await prisma.questionOption.upsert({
          where: { questionId_key: { questionId: upserted.id, key: option.key } },
          update: {
            label: option.label,
            jobWeights: option.jobWeights,
            domainWeights: option.domainWeights,
          },
          create: {
            questionId: upserted.id,
            key: option.key,
            label: option.label,
            jobWeights: option.jobWeights,
            domainWeights: option.domainWeights,
          },
        });
      }

      console.log(`  ✓ ${question.key}`);
    }

    const trackACount = QUESTIONS.filter(q =>
      q.askIfIn?.situation?.some(s => ['lycee', 'etudes_longues'].includes(s))
    ).length;
    const trackBCount = QUESTIONS.filter(q =>
      q.askIfIn?.situation?.some(s => ['actif', 'reconversion'].includes(s))
    ).length;
    const commonCount = QUESTIONS.filter(q => !q.askIfIn && !q.askIfEquals).length;

    console.log(`
✓ Seed terminé — questionnaire dual-track :
  Question initiale : 1
  Track A (étudiant) : ${trackACount} questions spécifiques
  Track B (actif/reconversion) : ${trackBCount} questions spécifiques
  Communes : ${commonCount} questions
  Total Track A : ${1 + trackACount + commonCount} questions
  Total Track B : ${1 + trackBCount + commonCount} questions`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
