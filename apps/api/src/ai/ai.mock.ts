import type { UserTrack } from './user-context';
import type {
  PersonalizedSheetContent,
  PortraitContent,
} from './ai.service';

/**
 * Données factices pour le mode développement (DEV_MOCK_AI=true).
 *
 * Permet de parcourir tout le flow (questionnaire → portrait → résultats →
 * fiche personnalisée) sans aucun appel IA réel, donc sans quota.
 *
 * ⚠️  NE JAMAIS activer en production. Le flag DEV_MOCK_AI doit rester
 * absent ou à "false" dans tout environnement exposé.
 *
 * Centraliser ici les données mock présente deux avantages :
 *   - AiService reste lisible (une ligne par méthode mocquée)
 *   - On peut faire évoluer le mock sans toucher à la logique métier
 */

// ── Portraits ─────────────────────────────────────────────────────────────────

export const MOCK_PORTRAITS: Record<UserTrack, PortraitContent> = {
  student: {
    archetype: 'Le Cartographe curieux',
    summary:
      "Tu es quelqu'un qui aime explorer des territoires inconnus — intellectuels surtout. " +
      "Tu as un radar naturel pour détecter les patterns là où d'autres voient du chaos, " +
      'et tu prends le temps de comprendre avant d\'agir.',
    strengths: ['Curiosité analytique', 'Vision d\'ensemble', 'Écoute active'],
    thrives: 'Résoudre des énigmes complexes qui ont un sens réel pour les autres',
    drains: "Exécuter des tâches répétitives sans comprendre pourquoi elles existent",
  },
  professional: {
    archetype: "L'Architecte du lien",
    summary:
      'Tu as construit au fil des années une capacité rare : relier les gens et les idées ' +
      "avec une rigueur que peu possèdent. Tu sais quand accélérer et quand prendre du recul " +
      "— c'est ce qui te rend précieux dans une équipe.",
    strengths: ['Structuration claire', 'Écoute stratégique', 'Passage à l\'action'],
    thrives:
      'Orchestrer des projets transverses où tu vois l\'impact direct sur les personnes impliquées',
    drains:
      'Les environnements où les décisions sont noyées dans les niveaux hiérarchiques sans fin',
  },
};

// ── Rationales ────────────────────────────────────────────────────────────────

export function mockRationale(job: { slug: string; title: string }, rank: number): string {
  const templates = [
    `${job.title} semble être un excellent match pour ton profil. Ton mode de fonctionnement naturel — explorer avant d'agir et chercher du sens dans ce que tu fais — correspond bien à ce que ce métier demande.`,
    `${job.title} est une piste solide à explorer. Tu y trouverais l'équilibre entre la réflexion que tu affectionnes et l'action concrète qui te donne de l'énergie.`,
    `${job.title} mérite ton attention : le cadre de travail et les valeurs de ce secteur sont alignés avec ce que tu recherches, même si une adaptation initiale sera nécessaire.`,
  ];
  return templates[Math.min(rank, templates.length - 1)];
}

// ── Fiche personnalisée ───────────────────────────────────────────────────────

export const MOCK_PERSONALIZED_SHEET: PersonalizedSheetContent = {
  strengths:
    "Ce métier colle bien à ta façon de fonctionner : tu aimes comprendre les systèmes en profondeur avant de les toucher, et c'est exactement ce qu'on attend ici. Ta capacité à faire le lien entre les besoins humains et les contraintes techniques sera un vrai atout.",
  watchPoints:
    "Attention au rythme : certaines phases de ce métier peuvent être répétitives. Si tu as besoin de variété pour rester motivé·e, pense à identifier à l'avance comment tu diversifieras tes missions.",
  nextSteps: [
    'Passe 2h sur LinkedIn à identifier 5 personnes qui ont ce titre de poste et envoie-leur un message de 3 lignes pour échanger 20 minutes.',
    'Trouve un projet open source ou une association où tu peux tester concrètement cette casquette pendant 4-6 semaines.',
    'Consulte le référentiel ROME de ce métier pour lister les compétences clés — et évalue honnêtement lesquelles tu as déjà.',
  ],
  dayInLife:
    "En semaine type, tu alternes entre moments de concentration profonde (analyse, conception) et échanges en équipe pour valider les directions. Les imprévus existent mais restent gérables. En fin de journée, tu vois souvent le résultat de ce que tu as produit — ce qui rend le tout satisfaisant.",
};
