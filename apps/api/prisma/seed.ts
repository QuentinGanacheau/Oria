import { Prisma, PrismaClient } from '@prisma/client';

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
    jobWeights: Record<string, number>;
  }>;
};

const QUESTIONS: SeedQuestion[] = [
  {
    key: 'situation',
    text: 'Tu es plutôt…',
    orderHint: 1,
    options: [
      { key: 'lycee', label: 'Au lycée / en études courtes', jobWeights: {} },
      { key: 'etudes_longues', label: 'En études longues (Bac+3 et +)', jobWeights: {} },
      { key: 'reconversion', label: 'En reconversion professionnelle', jobWeights: {} },
      { key: 'actif', label: 'Déjà en poste et tu explores d’autres voies', jobWeights: {} },
    ],
  },
  {
    key: 'energie',
    text: 'Ce qui te motive le plus au travail…',
    orderHint: 2,
    options: [
      {
        key: 'batir_produit',
        label: 'Construire un produit ou un service tangible',
        jobWeights: { 'dev-fullstack': 3, 'ux-designer': 2, 'product-owner': 3, 'chef-de-projet': 2 },
      },
      {
        key: 'donnees',
        label: 'Comprendre des phénomènes grâce aux chiffres',
        jobWeights: { 'data-analyst': 4, comptable: 2, 'data-scientist': 3, 'controleur-gestion': 2 },
      },
      {
        key: 'humain',
        label: 'Échanger avec des personnes et les convaincre',
        jobWeights: { 'sales-b2b': 4, 'hr-recruiter': 3, 'marketing-digital': 2, 'responsable-com': 2, 'charge-rh': 2, 'business-developer': 3 },
      },
      {
        key: 'strategie',
        label: 'Prioriser, arbitrer et faire avancer des projets',
        jobWeights: { 'product-owner': 3, 'marketing-digital': 2, 'consultant': 3, 'chef-de-projet': 3, 'business-developer': 2 },
      },
    ],
  },
  {
    key: 'environnement',
    text: 'Dans quel environnement tu t’épanouis le mieux ?',
    orderHint: 3,
    options: [
      {
        key: 'tech_equipe',
        label: 'Équipe tech / produit, rythme agile',
        jobWeights: { 'dev-fullstack': 3, 'ux-designer': 3, 'product-owner': 2, 'data-analyst': 2, 'data-scientist': 2, 'devops-cloud': 3 },
      },
      {
        key: 'terrain_client',
        label: 'Terrain, rendez-vous, négociation',
        jobWeights: { 'sales-b2b': 4, 'marketing-digital': 1, 'business-developer': 3, 'responsable-com': 1 },
      },
      {
        key: 'structure',
        label: 'Structure, process, cadre clair',
        jobWeights: { comptable: 3, 'hr-recruiter': 2, 'data-analyst': 1, 'controleur-gestion': 3, 'juriste': 3, 'office-manager': 3, 'charge-rh': 2 },
      },
      {
        key: 'creatif',
        label: 'Création, contenu, image de marque',
        jobWeights: { 'marketing-digital': 4, 'ux-designer': 2, 'content-creator': 4, 'graphiste': 4, 'responsable-com': 2 },
      },
    ],
  },
  {
    key: 'outils',
    text: 'Les outils qui t’attirent le plus…',
    orderHint: 4,
    options: [
      { key: 'code', label: 'IDE, lignes de code, automatisation', jobWeights: { 'dev-fullstack': 4, 'data-analyst': 1, 'devops-cloud': 3, 'data-scientist': 2 } },
      { key: 'visuel', label: 'Maquettes, design, expérience utilisateur', jobWeights: { 'ux-designer': 4, 'marketing-digital': 1, 'graphiste': 4, 'content-creator': 2 } },
      { key: 'tableurs_bi', label: 'Tableurs, requêtes SQL, dashboards', jobWeights: { 'data-analyst': 4, comptable: 2, 'controleur-gestion': 4, 'data-scientist': 2 } },
      { key: 'crm_docs', label: 'CRM, mails structurés, documentation métier', jobWeights: { 'sales-b2b': 2, 'hr-recruiter': 3, 'product-owner': 2, 'business-developer': 2, 'charge-rh': 2, 'office-manager': 3, 'juriste': 2, 'consultant': 1 } },
    ],
  },
  {
    key: 'orientation_concrete',
    text: 'Tu préfères…',
    orderHint: 5,
    askIfNotEquals: { situation: 'lycee' },
    options: [
      { key: 'livrer_feature', label: 'Livrer une fonctionnalité ou une analyse concrète', jobWeights: { 'dev-fullstack': 2, 'data-analyst': 2, 'ux-designer': 2, 'devops-cloud': 2 } },
      { key: 'pitch', label: 'Présenter, défendre une idée, closer', jobWeights: { 'sales-b2b': 3, 'marketing-digital': 2, 'business-developer': 3, 'consultant': 2, 'responsable-com': 1 } },
      { key: 'cadre', label: 'Sécuriser le cadre (juridique, chiffré, RH)', jobWeights: { comptable: 3, 'hr-recruiter': 2, 'controleur-gestion': 3, 'juriste': 4, 'charge-rh': 1 } },
      { key: 'vision', label: 'Définir la vision et coordonner les équipes', jobWeights: { 'product-owner': 3, 'consultant': 2, 'chef-de-projet': 3, 'responsable-com': 1 } },
    ],
  },
  {
    key: 'conseil_lycee',
    text: 'En ce moment, tu aimerais surtout…',
    orderHint: 6,
    askIfEquals: { situation: 'lycee' },
    options: [
      { key: 'decouvrir_num', label: 'Découvrir les métiers du numérique', jobWeights: { 'dev-fullstack': 2, 'ux-designer': 2, 'data-analyst': 1, 'devops-cloud': 1, 'data-scientist': 1 } },
      { key: 'aider_gens', label: 'Travailler avec et pour les gens', jobWeights: { 'hr-recruiter': 2, 'sales-b2b': 1, 'marketing-digital': 1, 'charge-rh': 2, 'office-manager': 1 } },
      { key: 'organiser', label: 'Organiser, planifier, rendre les choses claires', jobWeights: { 'product-owner': 1, comptable: 2, 'chef-de-projet': 2, 'office-manager': 2 } },
      { key: 'creer', label: 'Créer (contenu, visuel, idées)', jobWeights: { 'marketing-digital': 2, 'ux-designer': 2, 'content-creator': 3, 'graphiste': 3 } },
    ],
  },
  // --- Questions ouvertes : l'utilisateur parle de lui, l'IA extrait les signaux. ---
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
  {
    key: 'contrainte',
    text: 'Contrainte importante pour toi…',
    orderHint: 7,
    options: [
      { key: 'remote', label: 'Télétravail / flexibilité', jobWeights: { 'dev-fullstack': 1, 'data-analyst': 1, 'marketing-digital': 1, 'ux-designer': 1, 'data-scientist': 1, 'content-creator': 1, 'graphiste': 1 } },
      { key: 'impact', label: 'Impact visible rapidement', jobWeights: { 'sales-b2b': 1, 'marketing-digital': 1, 'business-developer': 1, 'consultant': 1, 'content-creator': 1 } },
      { key: 'stabilite', label: 'Stabilité et pérennité du métier', jobWeights: { comptable: 2, 'data-analyst': 1, 'hr-recruiter': 1, 'juriste': 2, 'office-manager': 1, 'controleur-gestion': 2, 'charge-rh': 1 } },
      { key: 'apprendre', label: 'Apprendre en continu des choses nouvelles', jobWeights: { 'dev-fullstack': 2, 'product-owner': 1, 'data-analyst': 1, 'consultant': 2, 'data-scientist': 2 } },
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
          },
          create: {
            questionId: upserted.id,
            key: option.key,
            label: option.label,
            jobWeights: option.jobWeights,
          },
        });
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
