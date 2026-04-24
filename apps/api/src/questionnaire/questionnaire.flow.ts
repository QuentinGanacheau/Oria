import type { JobSlug } from '../jobs/job.types';

export type JobScores = Partial<Record<JobSlug, number>>;

export interface QuestionOption {
  id: string;
  label: string;
  scores: JobScores;
}

export interface QuestionDefinition {
  id: string;
  text: string;
  options: QuestionOption[];
  /** Si vrai, la question est masquée pour ce profil de réponses. */
  skipIf?: (answers: Record<string, string>) => boolean;
}

export const QUESTIONNAIRE_FLOW: QuestionDefinition[] = [
  {
    id: 'situation',
    text: 'Tu es plutôt…',
    options: [
      {
        id: 'lycee',
        label: 'Au lycée / en études courtes',
        scores: {},
      },
      {
        id: 'etudes_longues',
        label: 'En études longues (Bac+3 et +)',
        scores: {},
      },
      {
        id: 'reconversion',
        label: 'En reconversion professionnelle',
        scores: {},
      },
      {
        id: 'actif',
        label: 'Déjà en poste et tu explores d’autres voies',
        scores: {},
      },
    ],
  },
  {
    id: 'energie',
    text: 'Ce qui te motive le plus au travail…',
    options: [
      {
        id: 'batir_produit',
        label: 'Construire un produit ou un service tangible',
        scores: {
          'dev-fullstack': 3,
          'ux-designer': 2,
          'product-owner': 3,
        },
      },
      {
        id: 'donnees',
        label: 'Comprendre des phénomènes grâce aux chiffres',
        scores: { 'data-analyst': 4, comptable: 2 },
      },
      {
        id: 'humain',
        label: 'Échanger avec des personnes et les convaincre',
        scores: {
          'sales-b2b': 4,
          'hr-recruiter': 3,
          'marketing-digital': 2,
        },
      },
      {
        id: 'strategie',
        label: 'Prioriser, arbitrer et faire avancer des projets',
        scores: { 'product-owner': 3, 'marketing-digital': 2 },
      },
    ],
  },
  {
    id: 'environnement',
    text: 'Dans quel environnement tu t’épanouis le mieux ?',
    options: [
      {
        id: 'tech_equipe',
        label: 'Équipe tech / produit, rythme agile',
        scores: {
          'dev-fullstack': 3,
          'ux-designer': 3,
          'product-owner': 2,
          'data-analyst': 2,
        },
      },
      {
        id: 'terrain_client',
        label: 'Terrain, rendez-vous, négociation',
        scores: { 'sales-b2b': 4, 'marketing-digital': 1 },
      },
      {
        id: 'structure',
        label: 'Structure, process, cadre clair',
        scores: { comptable: 3, 'hr-recruiter': 2, 'data-analyst': 1 },
      },
      {
        id: 'creatif',
        label: 'Création, contenu, image de marque',
        scores: { 'marketing-digital': 4, 'ux-designer': 2 },
      },
    ],
  },
  {
    id: 'outils',
    text: 'Les outils qui t’attirent le plus…',
    options: [
      {
        id: 'code',
        label: 'IDE, lignes de code, automatisation',
        scores: { 'dev-fullstack': 4, 'data-analyst': 1 },
      },
      {
        id: 'visuel',
        label: 'Maquettes, design, expérience utilisateur',
        scores: { 'ux-designer': 4, 'marketing-digital': 1 },
      },
      {
        id: 'tableurs_bi',
        label: 'Tableurs, requêtes SQL, dashboards',
        scores: { 'data-analyst': 4, comptable: 2 },
      },
      {
        id: 'crm_docs',
        label: 'CRM, mails structurés, documentation métier',
        scores: { 'sales-b2b': 2, 'hr-recruiter': 3, 'product-owner': 2 },
      },
    ],
  },
  {
    id: 'orientation_concrete',
    text: 'Tu préfères…',
    options: [
      {
        id: 'livrer_feature',
        label: 'Livrer une fonctionnalité ou une analyse concrète',
        scores: {
          'dev-fullstack': 2,
          'data-analyst': 2,
          'ux-designer': 2,
        },
      },
      {
        id: 'pitch',
        label: 'Présenter, défendre une idée, closer',
        scores: { 'sales-b2b': 3, 'marketing-digital': 2 },
      },
      {
        id: 'cadre',
        label: 'Sécuriser le cadre (juridique, chiffré, RH)',
        scores: { comptable: 3, 'hr-recruiter': 2 },
      },
      {
        id: 'vision',
        label: 'Définir la vision et coordonner les équipes',
        scores: { 'product-owner': 3 },
      },
    ],
    skipIf: (a) => a.situation === 'lycee',
  },
  {
    id: 'conseil_lycee',
    text: 'En ce moment, tu aimerais surtout…',
    options: [
      {
        id: 'decouvrir_num',
        label: 'Découvrir les métiers du numérique',
        scores: {
          'dev-fullstack': 2,
          'ux-designer': 2,
          'data-analyst': 1,
        },
      },
      {
        id: 'aider_gens',
        label: 'Travailler avec et pour les gens',
        scores: { 'hr-recruiter': 2, 'sales-b2b': 1, 'marketing-digital': 1 },
      },
      {
        id: 'organiser',
        label: 'Organiser, planifier, rendre les choses claires',
        scores: { 'product-owner': 1, comptable: 2 },
      },
      {
        id: 'creer',
        label: 'Créer (contenu, visuel, idées)',
        scores: { 'marketing-digital': 2, 'ux-designer': 2 },
      },
    ],
    skipIf: (a) => a.situation !== 'lycee',
  },
  {
    id: 'contrainte',
    text: 'Contrainte importante pour toi…',
    options: [
      {
        id: 'remote',
        label: 'Télétravail / flexibilité',
        scores: {
          'dev-fullstack': 1,
          'data-analyst': 1,
          'marketing-digital': 1,
          'ux-designer': 1,
        },
      },
      {
        id: 'impact',
        label: 'Impact visible rapidement',
        scores: { 'sales-b2b': 1, 'marketing-digital': 1 },
      },
      {
        id: 'stabilite',
        label: 'Stabilité et pérennité du métier',
        scores: { comptable: 2, 'data-analyst': 1, 'hr-recruiter': 1 },
      },
      {
        id: 'apprendre',
        label: 'Apprendre en continu des choses nouvelles',
        scores: {
          'dev-fullstack': 2,
          'product-owner': 1,
          'data-analyst': 1,
        },
      },
    ],
  },
];
