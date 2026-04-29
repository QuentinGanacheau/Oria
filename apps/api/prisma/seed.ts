import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Seed du questionnaire — Phase 2 : option mappées sur les grands domaines ROME.
 *
 * Format des `domainWeights` : { "M": 3, "J": 2, ... } où la clé est le code
 * ROME du grand domaine (cf. nomenclature France Travail) :
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
 * NB — Le champ legacy `jobWeights` reste rempli (parfois vide) pour ne pas
 * casser le schéma. Il sera retiré après stabilisation de la nouvelle UX.
 */
type SeedQuestion = {
  key: string;
  text: string;
  orderHint: number;
  type?: 'SINGLE_CHOICE' | 'FREE_TEXT';
  placeholder?: string;
  helperText?: string;
  askIfEquals?: Record<string, string>;
  askIfNotEquals?: Record<string, string>;
  options: Array<{
    key: string;
    label: string;
    /** Poids legacy (vide pour les nouvelles options). */
    jobWeights: Record<string, number>;
    /** Poids des grands domaines ROME (Phase 2). */
    domainWeights: Record<string, number>;
  }>;
};

const QUESTIONS: SeedQuestion[] = [
  // ── Question contextuelle (n'oriente pas le scoring) ───────────────────
  {
    key: 'situation',
    text: 'Tu es plutôt…',
    orderHint: 1,
    options: [
      { key: 'lycee', label: 'Au lycée / en études courtes', jobWeights: {}, domainWeights: {} },
      { key: 'etudes_longues', label: 'En études longues (Bac+3 et +)', jobWeights: {}, domainWeights: {} },
      { key: 'reconversion', label: 'En reconversion professionnelle', jobWeights: {}, domainWeights: {} },
      { key: 'actif', label: 'Déjà en poste et tu explores d’autres voies', jobWeights: {}, domainWeights: {} },
    ],
  },

  // ── Motivation ─────────────────────────────────────────────────────────
  {
    key: 'energie',
    text: 'Ce qui te motive le plus au travail…',
    orderHint: 2,
    options: [
      {
        key: 'batir_produit',
        label: 'Construire un produit ou un service tangible',
        jobWeights: {},
        domainWeights: { M: 3, F: 2, H: 2, B: 1 },
      },
      {
        key: 'donnees',
        label: 'Comprendre des phénomènes grâce aux chiffres',
        jobWeights: {},
        domainWeights: { M: 4, C: 3 },
      },
      {
        key: 'humain',
        label: 'Échanger avec des personnes et les convaincre',
        jobWeights: {},
        domainWeights: { D: 4, K: 2, M: 1 },
      },
      {
        key: 'strategie',
        label: 'Prioriser, arbitrer et faire avancer des projets',
        jobWeights: {},
        domainWeights: { M: 3, C: 1 },
      },
    ],
  },

  // ── Environnement ──────────────────────────────────────────────────────
  {
    key: 'environnement',
    text: 'Dans quel environnement tu t’épanouis le mieux ?',
    orderHint: 3,
    options: [
      {
        key: 'tech_equipe',
        label: 'Équipe tech / produit, rythme agile',
        jobWeights: {},
        domainWeights: { M: 4 },
      },
      {
        key: 'terrain_client',
        label: 'Terrain, rendez-vous, négociation',
        jobWeights: {},
        domainWeights: { D: 4, C: 2 },
      },
      {
        key: 'structure',
        label: 'Structure, process, cadre clair',
        jobWeights: {},
        domainWeights: { M: 3, C: 2, K: 1 },
      },
      {
        key: 'creatif',
        label: 'Création, contenu, image de marque',
        jobWeights: {},
        domainWeights: { E: 4, B: 2, L: 1 },
      },
    ],
  },

  // ── Outils ─────────────────────────────────────────────────────────────
  {
    key: 'outils',
    text: 'Les outils qui t’attirent le plus…',
    orderHint: 4,
    options: [
      { key: 'code', label: 'IDE, lignes de code, automatisation', jobWeights: {}, domainWeights: { M: 4 } },
      { key: 'visuel', label: 'Maquettes, design, expérience utilisateur', jobWeights: {}, domainWeights: { E: 3, B: 2 } },
      { key: 'tableurs_bi', label: 'Tableurs, requêtes SQL, dashboards', jobWeights: {}, domainWeights: { M: 4, C: 2 } },
      { key: 'crm_docs', label: 'CRM, mails structurés, documentation métier', jobWeights: {}, domainWeights: { M: 3, D: 2 } },
    ],
  },

  // ── Orientation concrète (pour non-lycéens) ────────────────────────────
  {
    key: 'orientation_concrete',
    text: 'Tu préfères…',
    orderHint: 5,
    askIfNotEquals: { situation: 'lycee' },
    options: [
      { key: 'livrer_feature', label: 'Livrer une fonctionnalité ou une analyse concrète', jobWeights: {}, domainWeights: { M: 3 } },
      { key: 'pitch', label: 'Présenter, défendre une idée, closer', jobWeights: {}, domainWeights: { D: 3, M: 1, E: 1 } },
      { key: 'cadre', label: 'Sécuriser le cadre (juridique, chiffré, RH)', jobWeights: {}, domainWeights: { M: 3, C: 2 } },
      { key: 'vision', label: 'Définir la vision et coordonner les équipes', jobWeights: {}, domainWeights: { M: 3 } },
    ],
  },

  // ── Conseil lycéens ────────────────────────────────────────────────────
  {
    key: 'conseil_lycee',
    text: 'En ce moment, tu aimerais surtout…',
    orderHint: 6,
    askIfEquals: { situation: 'lycee' },
    options: [
      { key: 'decouvrir_num', label: 'Découvrir les métiers du numérique', jobWeights: {}, domainWeights: { M: 3 } },
      { key: 'aider_gens', label: 'Travailler avec et pour les gens', jobWeights: {}, domainWeights: { K: 3, J: 2, M: 1 } },
      { key: 'organiser', label: 'Organiser, planifier, rendre les choses claires', jobWeights: {}, domainWeights: { M: 2, K: 1 } },
      { key: 'creer', label: 'Créer (contenu, visuel, idées)', jobWeights: {}, domainWeights: { E: 3, B: 2, L: 1 } },
    ],
  },

  // ── Questions ouvertes (texte libre) ──────────────────────────────────
  // Ces questions n'ont pas d'options. Le texte libre n'alimente pas le
  // scoring par domaine, mais il est transmis tel quel à l'IA pour le
  // reranking final — où il a son maximum d'impact.
  {
    key: 'journee_ideale',
    text: 'Raconte une journée (passée ou imaginée) où tu t\'es senti pleinement à ta place. Que faisais-tu ? Avec qui ? Qu\'est-ce qui la rendait bonne ?',
    orderHint: 10,
    type: 'FREE_TEXT',
    placeholder: 'Ex : "J\'organisais un évènement pour l\'asso, je coordonnais les bénévoles, je voyais les gens sourire..."',
    helperText: 'Plus tu es concret et personnel, mieux c\'est. 2 à 5 phrases suffisent.',
    options: [],
  },
  {
    key: 'irritants',
    text: 'À l\'inverse, qu\'est-ce qui te gonfle ou t\'épuise dans un boulot, dans les études ou en groupe ?',
    orderHint: 11,
    type: 'FREE_TEXT',
    placeholder: 'Ex : "Faire la même tâche répétitive, les réunions sans décision, travailler seul devant un écran..."',
    helperText: 'Les choses à éviter en disent autant que celles qu\'on aime.',
    options: [],
  },
  {
    key: 'fascination',
    text: 'Un métier, une personne dont tu admires le travail, ou une activité qui te fascine — et pourquoi ?',
    orderHint: 12,
    type: 'FREE_TEXT',
    placeholder: 'Ex : "Ma cousine est sage-femme, j\'adore qu\'elle aide les gens dans un moment important..."',
    helperText: 'Même si ce n\'est pas un métier que tu veux faire, explique ce qui t\'attire.',
    options: [],
  },

  // ── Contrainte ─────────────────────────────────────────────────────────
  {
    key: 'contrainte',
    text: 'Contrainte importante pour toi…',
    orderHint: 7,
    options: [
      { key: 'remote', label: 'Télétravail / flexibilité', jobWeights: {}, domainWeights: { M: 1, E: 1 } },
      { key: 'impact', label: 'Impact visible rapidement', jobWeights: {}, domainWeights: { D: 2, E: 1, M: 1 } },
      { key: 'stabilite', label: 'Stabilité et pérennité du métier', jobWeights: {}, domainWeights: { M: 2, C: 2, K: 1, J: 1 } },
      { key: 'apprendre', label: 'Apprendre en continu des choses nouvelles', jobWeights: {}, domainWeights: { M: 2 } },
    ],
  },
];

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
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
          active: true,
        },
      });

      for (const option of question.options) {
        await prisma.questionOption.upsert({
          where: {
            questionId_key: {
              questionId: upserted.id,
              key: option.key,
            },
          },
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
    }
    console.log('✓ Seed terminé.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
