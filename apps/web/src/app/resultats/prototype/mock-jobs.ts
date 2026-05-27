import type { SwipeCardData } from "../swipe-card";

/**
 * Données factices pour le prototype du swipe deck.
 * Permet d'itérer sur l'UX sans dépendre de l'API ni du pipeline de matching.
 * 8 métiers → assez pour swiper au-delà du batch gratuit (3) et sentir le rythme.
 *
 * Les champs missions/skills/salaryRangeHint sont surtout affichés en desktop,
 * où la carte a plus de place. Ils correspondent au shape réel de `job`.
 */
export const MOCK_JOBS: SwipeCardData[] = [
  {
    slug: "M1805",
    title: "Développeur·se full-stack",
    tagline: "Conçoit des applications web de bout en bout, du serveur à l'interface.",
    scorePercent: 92,
    rationale:
      "Ton goût pour résoudre des problèmes concrets et ton autonomie collent à un métier où l'on construit des produits du début à la fin.",
    missions: [
      "Développer les interfaces et la logique serveur",
      "Concevoir des bases de données et des API",
      "Corriger les bugs et améliorer les performances",
    ],
    skills: ["JavaScript", "React", "SQL", "Git", "Résolution de problèmes"],
    salaryRangeHint: "35–55 k€ brut/an en début de carrière",
  },
  {
    slug: "E1104",
    title: "Concepteur·rice de contenus digitaux",
    tagline: "Imagine et produit des contenus pour le web et les réseaux.",
    scorePercent: 87,
    rationale:
      "Tu as cité la créativité comme moteur — ce métier mélange production visuelle et stratégie éditoriale.",
    missions: [
      "Créer des contenus écrits, visuels et vidéo",
      "Animer une ligne éditoriale sur les réseaux",
      "Analyser l'engagement et ajuster la stratégie",
    ],
    skills: ["Rédaction", "Design", "Réseaux sociaux", "Storytelling"],
    salaryRangeHint: "28–40 k€ brut/an",
  },
  {
    slug: "M1403",
    title: "Analyste d'études / Data analyst",
    tagline: "Transforme des données brutes en décisions concrètes.",
    scorePercent: 81,
    rationale:
      "Ton attrait pour comprendre 'le pourquoi des choses' s'épanouit dans l'analyse de données.",
    missions: [
      "Collecter et nettoyer les données",
      "Construire des tableaux de bord et des indicateurs",
      "Présenter des recommandations aux équipes",
    ],
    skills: ["SQL", "Excel", "Statistiques", "Data viz", "Esprit critique"],
    salaryRangeHint: "32–48 k€ brut/an",
  },
  {
    slug: "K2104",
    title: "Enseignant·e / Formateur·rice",
    tagline: "Transmet des savoirs et accompagne la progression des autres.",
    scorePercent: 74,
    rationale:
      "Tu as dit aimer expliquer et voir les autres progresser — la transmission est au cœur de ce métier.",
    missions: [
      "Préparer et animer des cours ou formations",
      "Évaluer la progression des apprenants",
      "Adapter sa pédagogie à chaque public",
    ],
    skills: ["Pédagogie", "Communication", "Patience", "Organisation"],
    salaryRangeHint: "25–40 k€ brut/an",
  },
  {
    slug: "M1402",
    title: "Consultant·e en organisation",
    tagline: "Aide les entreprises à repenser leurs façons de travailler.",
    scorePercent: 69,
    rationale:
      "Ta capacité à prendre du recul et à structurer pourrait s'exprimer dans le conseil.",
    missions: [
      "Diagnostiquer les dysfonctionnements d'une organisation",
      "Proposer et piloter des plans d'amélioration",
      "Accompagner le changement auprès des équipes",
    ],
    skills: ["Analyse", "Gestion de projet", "Communication", "Synthèse"],
    salaryRangeHint: "38–60 k€ brut/an",
  },
  {
    slug: "B1301",
    title: "Artisan·e / Métier manuel créatif",
    tagline: "Fabrique des objets de ses mains, du concept à la réalisation.",
    scorePercent: 63,
    rationale:
      "Tu as évoqué l'envie de produire du concret et tangible — l'artisanat répond à ce besoin.",
    missions: [
      "Concevoir et réaliser des pièces sur mesure",
      "Maîtriser les matériaux et les outils",
      "Gérer la relation avec les clients",
    ],
    skills: ["Minutie", "Créativité", "Sens du détail", "Autonomie"],
    salaryRangeHint: "Variable selon statut (SMIC à 35 k€+)",
  },
  {
    slug: "J1506",
    title: "Infirmier·ère",
    tagline: "Prend soin des patients au quotidien dans une équipe de santé.",
    scorePercent: 58,
    rationale:
      "Ton attrait pour le contact humain et l'utilité sociale trouve un débouché clair dans le soin.",
    missions: [
      "Réaliser les soins et surveiller les patients",
      "Coordonner avec médecins et aides-soignants",
      "Accompagner les patients et leurs proches",
    ],
    skills: ["Rigueur", "Empathie", "Sang-froid", "Travail en équipe"],
    salaryRangeHint: "28–42 k€ brut/an",
  },
  {
    slug: "G1102",
    title: "Chargé·e d'accueil / Tourisme",
    tagline: "Accueille, informe et oriente le public dans un cadre vivant.",
    scorePercent: 51,
    rationale:
      "Tu apprécies les environnements dynamiques et le contact — l'accueil correspond à ce profil.",
    missions: [
      "Accueillir et renseigner les visiteurs",
      "Gérer les réservations et l'information",
      "Promouvoir les offres et activités locales",
    ],
    skills: ["Aisance relationnelle", "Langues", "Sourire", "Polyvalence"],
    salaryRangeHint: "SMIC à 30 k€ brut/an",
  },
];
