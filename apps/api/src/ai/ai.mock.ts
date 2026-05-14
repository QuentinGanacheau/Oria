import type { UserTrack } from './user-context';
import type {
  PersonalizedSheetContent,
  PortraitContent,
  RankWithPreferencesInput,
  RankWithPreferencesResult,
} from './ai.service';

// ── Types ─────────────────────────────────────────────────────────────────────

type TrackRecord<T> = Record<UserTrack, T>;

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

// ── Raffinement par préférences (Phase 4) ─────────────────────────────────────

export function MOCK_RANK_WITH_PREFERENCES(
  input: RankWithPreferencesInput,
): RankWithPreferencesResult {
  const scores: Record<string, number> = {};
  input.candidates.forEach((c, i) => {
    scores[c.code] = Math.max(20, 88 - i * 6);
  });

  const hasLiked = input.likedJobs.length > 0;
  const hasDislikedWithReason = input.dislikedJobs.some((j) => j.reason);

  let insight = 'Tu sembles apprécier les métiers qui combinent autonomie et impact concret.';
  if (hasLiked && hasDislikedWithReason) {
    insight =
      'Tes notes montrent que tu veux de la créativité sans la pression commerciale — ces pistes correspondent mieux à ça.';
  } else if (hasLiked) {
    insight =
      'D\'après tes appréciations, tu es attiré par les métiers qui mêlent réflexion et réalisation concrète.';
  }

  return { scores, insight };
}

export function mockRationale(job: { slug: string; title: string }, rank: number): string {
  const templates = [
    `${job.title} semble être un excellent match pour ton profil. Ton mode de fonctionnement naturel — explorer avant d'agir et chercher du sens dans ce que tu fais — correspond bien à ce que ce métier demande.`,
    `${job.title} est une piste solide à explorer. Tu y trouverais l'équilibre entre la réflexion que tu affectionnes et l'action concrète qui te donne de l'énergie.`,
    `${job.title} mérite ton attention : le cadre de travail et les valeurs de ce secteur sont alignés avec ce que tu recherches, même si une adaptation initiale sera nécessaire.`,
  ];
  return templates[Math.min(rank, templates.length - 1)];
}

// ── Fiches personnalisées (track-spécifiques) ─────────────────────────────────

export const MOCK_PERSONALIZED_SHEET: TrackRecord<PersonalizedSheetContent> = {
  student: {
    strengths:
      "Ce métier peut vraiment nourrir ta curiosité : tu as dit que ce qui te fascine, c'est comprendre les systèmes avant d'agir. Ici, c'est exactement ce qu'on valorise. Ton envie de voir l'impact concret de ce que tu construis trouvera de quoi s'exprimer.",
    watchPoints:
      "Sois honnête avec toi-même : si les tâches répétitives te pèsent (tu l'as mentionné dans tes irritants), certaines phases de ce métier risquent de te demander beaucoup de discipline. La formation initiale est aussi plus longue que la moyenne — assure-toi que tu es prêt·e pour ça.",
    nextSteps: [
      'Trouve 2-3 personnes qui exercent ce métier et demande-leur 20 minutes pour comprendre leur quotidien réel — LinkedIn ou des événements sectoriels.',
      'Teste tes aptitudes sans t\'engager : un MOOC de 4 semaines ou un projet perso court te donnera une vraie idée de ce que tu ressentiras au quotidien.',
      'Consulte le référentiel ROME de ce métier et fais la liste des compétences clés — tu en as probablement déjà plusieurs sans le réaliser.',
    ],
    dayInLife:
      "Tu commences souvent par un point rapide avec l'équipe pour aligner les priorités du jour. Ensuite, tu alternes entre phases de concentration (conception, analyse, production) et moments d'échange pour valider ou débloquer. En fin de journée, tu vois généralement le résultat de ce que tu as produit — et c'est souvent ce qui donne de l'énergie pour la suite.",
  },
  professional: {
    strengths:
      "La continuité avec ton parcours est réelle : les compétences de structuration et d'écoute que tu as développées sont directement valorisables ici. Ce n'est pas un virage à 180°, c'est une évolution — ce qui rend la transition plus solide.",
    watchPoints:
      "Ce point mérite d'être dit clairement : si ce qui te pèse aujourd'hui (les réunions sans décision, le manque de sens) existe aussi dans ce métier, ça ne changera pas magiquement. Assure-toi de valider ce point avec des gens qui le font vraiment avant de t'engager.",
    nextSteps: [
      'Avant tout : parle à 2-3 personnes qui ont fait cette transition. Demande-leur ce qui les a surpris — en bien et en mal. C\'est l\'info la plus précieuse.',
      'Évalue ton gap réel : liste les compétences requises et celles que tu as déjà. Tu vas probablement découvrir que tu es plus proche que tu ne le crois.',
      'Teste à petite échelle sans quitter ton poste : mission freelance, projet associatif, quelques heures de conseil. Valide que tu aimes vraiment ça en conditions réelles.',
    ],
    dayInLife:
      "La semaine type alterne entre travail en solo (analyse, conception, production) et collaboration avec des collègues ou partenaires. Les réunions existent mais restent ciblées sur des décisions concrètes. Tu as généralement de l'autonomie sur ta façon d'organiser ton travail — ce qui convient bien si tu as besoin de te concentrer profondément.",
  },
};
