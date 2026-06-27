import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Logger } from '@nestjs/common';
import { AiService } from './ai.service';
import type { AiProvider } from './providers/ai-provider.interface';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Construit un mock AiProvider dont `complete` renvoie la valeur fournie. */
function buildProvider(name: string, response: string): AiProvider {
  return { name, complete: vi.fn().mockResolvedValue(response) };
}

/** Construit un AiService en injectant directement un provider mocké. */
function buildService(provider: AiProvider | null): AiService {
  const configMock = { get: vi.fn().mockReturnValue(undefined) } as any;
  const service = new AiService(configMock);
  // Injection directe dans la propriété privée pour contrôler le provider
  (service as any).provider = provider;
  return service;
}

// ─── Données de test réutilisables ───────────────────────────────────────────

const SAMPLE_ANSWERS = [
  { question: 'Que recherchez-vous ?', answer: 'Un métier créatif' },
  { question: 'Situation actuelle ?', answer: 'lycéen' },
];

const SAMPLE_QCM_ANSWERS = [
  { question: 'Que recherchez-vous ?', option: 'Créativité' },
];

// ─── Suite principale ─────────────────────────────────────────────────────────

describe('AiService', () => {
  // ─── isEnabled ───────────────────────────────────────────────────────────

  describe('isEnabled', () => {
    it('retourne true quand un provider est configuré', () => {
      const service = buildService(buildProvider('openai', '{}'));
      expect(service.isEnabled()).toBe(true);
    });

    it('retourne false quand aucun provider n\'est disponible', () => {
      const service = buildService(null);
      expect(service.isEnabled()).toBe(false);
    });
  });

  // ─── chooseQuestion ──────────────────────────────────────────────────────

  describe('chooseQuestion', () => {
    it('retourne la clé de question choisie par l\'IA', async () => {
      const provider = buildProvider('openai', JSON.stringify({ questionKey: 'q_creativity' }));
      const service = buildService(provider);

      const result = await service.chooseQuestion({
        candidateKeys: ['q_creativity', 'q_teamwork'],
        answers: SAMPLE_QCM_ANSWERS,
      });

      expect(result).toBe('q_creativity');
      expect(provider.complete).toHaveBeenCalledOnce();
    });

    it('retourne null si la clé retournée par l\'IA n\'est pas dans la liste autorisée', async () => {
      const provider = buildProvider('openai', JSON.stringify({ questionKey: 'q_inconnue' }));
      const service = buildService(provider);

      const result = await service.chooseQuestion({
        candidateKeys: ['q_creativity', 'q_teamwork'],
        answers: SAMPLE_QCM_ANSWERS,
      });

      expect(result).toBeNull();
    });

    it('retourne null si la réponse IA ne contient pas de champ questionKey', async () => {
      const provider = buildProvider('openai', JSON.stringify({ autre: 'valeur' }));
      const service = buildService(provider);

      const result = await service.chooseQuestion({
        candidateKeys: ['q_creativity'],
        answers: [],
      });

      expect(result).toBeNull();
    });

    it('retourne null si aucun provider n\'est disponible', async () => {
      const service = buildService(null);

      const result = await service.chooseQuestion({
        candidateKeys: ['q_creativity'],
        answers: SAMPLE_QCM_ANSWERS,
      });

      expect(result).toBeNull();
    });

    it('retourne null si la liste de candidats est vide', async () => {
      const provider = buildProvider('openai', JSON.stringify({ questionKey: 'q_creativity' }));
      const service = buildService(provider);

      const result = await service.chooseQuestion({
        candidateKeys: [],
        answers: SAMPLE_QCM_ANSWERS,
      });

      expect(result).toBeNull();
      expect(provider.complete).not.toHaveBeenCalled();
    });

    it('retourne null si l\'IA retourne du JSON invalide', async () => {
      const provider = buildProvider('openai', 'pas du json');
      const service = buildService(provider);

      const result = await service.chooseQuestion({
        candidateKeys: ['q_creativity'],
        answers: SAMPLE_QCM_ANSWERS,
      });

      expect(result).toBeNull();
    });

    it('retourne null si l\'IA lève une exception', async () => {
      const provider = buildProvider('openai', '');
      (provider.complete as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('timeout'));
      const service = buildService(provider);

      const result = await service.chooseQuestion({
        candidateKeys: ['q_creativity'],
        answers: SAMPLE_QCM_ANSWERS,
      });

      expect(result).toBeNull();
    });

    it('nettoie les balises markdown avant de parser le JSON', async () => {
      const provider = buildProvider(
        'gemini',
        '```json\n{"questionKey":"q_creativity"}\n```',
      );
      const service = buildService(provider);

      const result = await service.chooseQuestion({
        candidateKeys: ['q_creativity'],
        answers: [],
      });

      expect(result).toBe('q_creativity');
    });
  });

  // ─── adjustScores ────────────────────────────────────────────────────────

  describe('adjustScores', () => {
    it('retourne les multiplicateurs clamped dans [0.9 ; 1.1]', async () => {
      const provider = buildProvider(
        'openai',
        JSON.stringify({ multipliers: { 'dev-web': 1.05, 'data-analyst': 0.95 } }),
      );
      const service = buildService(provider);

      const result = await service.adjustScores({
        topJobs: [
          { slug: 'dev-web', score: 80 },
          { slug: 'data-analyst', score: 70 },
        ],
        answers: SAMPLE_QCM_ANSWERS,
      });

      expect(result).toEqual({ 'dev-web': 1.05, 'data-analyst': 0.95 });
    });

    it('clamp les valeurs hors bornes retournées par l\'IA', async () => {
      const provider = buildProvider(
        'openai',
        JSON.stringify({ multipliers: { 'dev-web': 2.0, 'data-analyst': 0.5 } }),
      );
      const service = buildService(provider);

      const result = await service.adjustScores({
        topJobs: [
          { slug: 'dev-web', score: 80 },
          { slug: 'data-analyst', score: 70 },
        ],
        answers: SAMPLE_QCM_ANSWERS,
      });

      expect(result).toEqual({ 'dev-web': 1.1, 'data-analyst': 0.9 });
    });

    it('ignore les valeurs non-numériques dans les multiplicateurs', async () => {
      const provider = buildProvider(
        'openai',
        JSON.stringify({ multipliers: { 'dev-web': 'fort', 'data-analyst': 1.0 } }),
      );
      const service = buildService(provider);

      const result = await service.adjustScores({
        topJobs: [
          { slug: 'dev-web', score: 80 },
          { slug: 'data-analyst', score: 70 },
        ],
        answers: SAMPLE_QCM_ANSWERS,
      });

      expect(result).toEqual({ 'data-analyst': 1.0 });
    });

    it('retourne null si aucun provider n\'est disponible', async () => {
      const service = buildService(null);

      const result = await service.adjustScores({
        topJobs: [{ slug: 'dev-web', score: 80 }],
        answers: SAMPLE_QCM_ANSWERS,
      });

      expect(result).toBeNull();
    });

    it('retourne null si la liste topJobs est vide', async () => {
      const provider = buildProvider('openai', JSON.stringify({ multipliers: {} }));
      const service = buildService(provider);

      const result = await service.adjustScores({
        topJobs: [],
        answers: SAMPLE_QCM_ANSWERS,
      });

      expect(result).toBeNull();
      expect(provider.complete).not.toHaveBeenCalled();
    });

    it('retourne null si la réponse IA ne contient pas de champ multipliers', async () => {
      const provider = buildProvider('openai', JSON.stringify({ scores: {} }));
      const service = buildService(provider);

      const result = await service.adjustScores({
        topJobs: [{ slug: 'dev-web', score: 80 }],
        answers: SAMPLE_QCM_ANSWERS,
      });

      expect(result).toBeNull();
    });

    it('retourne null si l\'IA lève une exception', async () => {
      const provider = buildProvider('openai', '');
      (provider.complete as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('quota exceeded'));
      const service = buildService(provider);

      const result = await service.adjustScores({
        topJobs: [{ slug: 'dev-web', score: 80 }],
        answers: SAMPLE_QCM_ANSWERS,
      });

      expect(result).toBeNull();
    });
  });

  // ─── extractWeightsFromText ──────────────────────────────────────────────

  describe('extractWeightsFromText', () => {
    it('retourne les poids extraits par l\'IA pour les slugs fournis', async () => {
      const provider = buildProvider(
        'openai',
        JSON.stringify({ weights: { 'dev-web': 4, 'graphiste': 2 } }),
      );
      const service = buildService(provider);

      const result = await service.extractWeightsFromText({
        question: 'Qu\'aimez-vous faire ?',
        text: "J'adore coder des interfaces web",
        jobSlugs: ['dev-web', 'graphiste', 'comptable'],
      });

      expect(result).toEqual({ 'dev-web': 4, 'graphiste': 2 });
    });

    it('clamp les poids dans [0 ; 5] et arrondit à l\'entier le plus proche', async () => {
      const provider = buildProvider(
        'openai',
        JSON.stringify({ weights: { 'dev-web': 7, 'graphiste': -1, 'comptable': 3.7 } }),
      );
      const service = buildService(provider);

      const result = await service.extractWeightsFromText({
        question: 'Qu\'aimez-vous faire ?',
        text: 'Je veux devenir développeur',
        jobSlugs: ['dev-web', 'graphiste', 'comptable'],
      });

      expect(result).toEqual({ 'dev-web': 5, 'graphiste': 0, 'comptable': 4 });
    });

    it('ignore les slugs retournés par l\'IA qui ne sont pas dans la liste autorisée', async () => {
      const provider = buildProvider(
        'openai',
        JSON.stringify({ weights: { 'dev-web': 4, 'slug-inconnu': 5 } }),
      );
      const service = buildService(provider);

      const result = await service.extractWeightsFromText({
        question: 'Qu\'aimez-vous faire ?',
        text: 'Je code depuis des années',
        jobSlugs: ['dev-web', 'graphiste'],
      });

      expect(result).toEqual({ 'dev-web': 4 });
      expect(result).not.toHaveProperty('slug-inconnu');
    });

    it('retourne null si aucun provider n\'est disponible', async () => {
      const service = buildService(null);

      const result = await service.extractWeightsFromText({
        question: 'Question',
        text: 'Une réponse valide',
        jobSlugs: ['dev-web'],
      });

      expect(result).toBeNull();
    });

    it('retourne null si le texte est trop court (< 3 caractères non-espaces)', async () => {
      const provider = buildProvider('openai', JSON.stringify({ weights: { 'dev-web': 4 } }));
      const service = buildService(provider);

      const result = await service.extractWeightsFromText({
        question: 'Question',
        text: 'ab',
        jobSlugs: ['dev-web'],
      });

      expect(result).toBeNull();
      expect(provider.complete).not.toHaveBeenCalled();
    });

    it('retourne null si le texte est uniquement composé d\'espaces', async () => {
      const provider = buildProvider('openai', JSON.stringify({ weights: { 'dev-web': 4 } }));
      const service = buildService(provider);

      const result = await service.extractWeightsFromText({
        question: 'Question',
        text: '   ',
        jobSlugs: ['dev-web'],
      });

      expect(result).toBeNull();
      expect(provider.complete).not.toHaveBeenCalled();
    });

    it('retourne null si la réponse IA ne contient pas de champ weights', async () => {
      const provider = buildProvider('openai', JSON.stringify({ autre: {} }));
      const service = buildService(provider);

      const result = await service.extractWeightsFromText({
        question: 'Question',
        text: 'Réponse longue et valide',
        jobSlugs: ['dev-web'],
      });

      expect(result).toBeNull();
    });
  });

  // ─── generateRationales ──────────────────────────────────────────────────

  describe('generateRationales', () => {
    it('retourne les explications personnalisées indexées par slug', async () => {
      const provider = buildProvider(
        'openai',
        JSON.stringify({
          rationales: {
            'dev-web': 'Ce métier te correspond car tu aimes coder.',
            'data-analyst': 'Ton goût pour les chiffres est un atout.',
          },
        }),
      );
      const service = buildService(provider);

      const result = await service.generateRationales({
        topJobs: [
          { slug: 'dev-web', title: 'Développeur web' },
          { slug: 'data-analyst', title: 'Data analyst' },
        ],
        answers: SAMPLE_ANSWERS,
      });

      expect(result).toEqual({
        'dev-web': 'Ce métier te correspond car tu aimes coder.',
        'data-analyst': 'Ton goût pour les chiffres est un atout.',
      });
    });

    it('filtre les slugs non demandés présents dans la réponse IA', async () => {
      const provider = buildProvider(
        'openai',
        JSON.stringify({
          rationales: {
            'dev-web': 'Explication dev web.',
            'slug-inattendu': 'Explication non sollicitée.',
          },
        }),
      );
      const service = buildService(provider);

      const result = await service.generateRationales({
        topJobs: [{ slug: 'dev-web', title: 'Développeur web' }],
        answers: SAMPLE_ANSWERS,
      });

      expect(result).toEqual({ 'dev-web': 'Explication dev web.' });
      expect(result).not.toHaveProperty('slug-inattendu');
    });

    it('retourne null si toutes les explications retournées sont vides', async () => {
      const provider = buildProvider(
        'openai',
        JSON.stringify({ rationales: { 'dev-web': '   ' } }),
      );
      const service = buildService(provider);

      const result = await service.generateRationales({
        topJobs: [{ slug: 'dev-web', title: 'Développeur web' }],
        answers: SAMPLE_ANSWERS,
      });

      expect(result).toBeNull();
    });

    it('retourne null si aucun provider n\'est disponible', async () => {
      const service = buildService(null);

      const result = await service.generateRationales({
        topJobs: [{ slug: 'dev-web', title: 'Développeur web' }],
        answers: SAMPLE_ANSWERS,
      });

      expect(result).toBeNull();
    });

    it('retourne null si la liste topJobs est vide', async () => {
      const provider = buildProvider('openai', JSON.stringify({ rationales: {} }));
      const service = buildService(provider);

      const result = await service.generateRationales({
        topJobs: [],
        answers: SAMPLE_ANSWERS,
      });

      expect(result).toBeNull();
      expect(provider.complete).not.toHaveBeenCalled();
    });

    it('retourne null si la réponse IA ne contient pas de champ rationales', async () => {
      const provider = buildProvider('openai', JSON.stringify({ autre: {} }));
      const service = buildService(provider);

      const result = await service.generateRationales({
        topJobs: [{ slug: 'dev-web', title: 'Développeur web' }],
        answers: SAMPLE_ANSWERS,
      });

      expect(result).toBeNull();
    });

    it('retourne null si l\'IA lève une exception', async () => {
      const provider = buildProvider('openai', '');
      (provider.complete as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network error'));
      const service = buildService(provider);

      const result = await service.generateRationales({
        topJobs: [{ slug: 'dev-web', title: 'Développeur web' }],
        answers: SAMPLE_ANSWERS,
      });

      expect(result).toBeNull();
    });
  });

  // ─── generatePersonalizedSheet ───────────────────────────────────────────

  describe('generatePersonalizedSheet', () => {
    const VALID_SHEET_RESPONSE = {
      strengths: 'Tu adores les défis techniques, ce qui colle parfaitement avec ce métier.',
      watchPoints: 'La sédentarité du poste peut être un frein si tu aimes bouger.',
      nextSteps: ['Faire un stage', 'Suivre une formation en ligne', 'Participer à un hackathon'],
      dayInLife: 'Tu commences ta journée en code review, puis tu développes de nouvelles fonctionnalités.',
    };

    it('retourne une fiche personnalisée complète et valide', async () => {
      const provider = buildProvider('openai', JSON.stringify(VALID_SHEET_RESPONSE));
      const service = buildService(provider);

      const result = await service.generatePersonalizedSheet({
        job: {
          title: 'Développeur web',
          summary: 'Crée des applications web.',
          missions: ['Coder', 'Tester'],
          skills: ['JavaScript', 'React'],
        },
        answers: SAMPLE_ANSWERS,
        rank: 1,
        situation: 'lycee',
      });

      // actionPlan absent de la réponse IA → null (dégradation propre, Phase 5).
      expect(result).toEqual({ ...VALID_SHEET_RESPONSE, actionPlan: null });
    });

    it('tronque nextSteps à 3 éléments maximum', async () => {
      const provider = buildProvider(
        'openai',
        JSON.stringify({
          ...VALID_SHEET_RESPONSE,
          nextSteps: ['Étape 1', 'Étape 2', 'Étape 3', 'Étape 4', 'Étape 5'],
        }),
      );
      const service = buildService(provider);

      const result = await service.generatePersonalizedSheet({
        job: {
          title: 'Développeur web',
          summary: 'Crée des applications web.',
          missions: ['Coder'],
          skills: ['JS'],
        },
        answers: SAMPLE_ANSWERS,
        rank: 1,
        situation: 'actif',
      });

      expect(result?.nextSteps).toHaveLength(3);
      expect(result?.nextSteps).toEqual(['Étape 1', 'Étape 2', 'Étape 3']);
    });

    it('filtre les éléments non-string ou vides de nextSteps', async () => {
      const provider = buildProvider(
        'openai',
        JSON.stringify({
          ...VALID_SHEET_RESPONSE,
          nextSteps: ['Étape valide', '', 42, null, 'Autre étape'],
        }),
      );
      const service = buildService(provider);

      const result = await service.generatePersonalizedSheet({
        job: {
          title: 'Développeur web',
          summary: 'Crée des applications web.',
          missions: ['Coder'],
          skills: ['JS'],
        },
        answers: SAMPLE_ANSWERS,
        rank: 1,
        situation: 'reconversion',
      });

      expect(result?.nextSteps).toEqual(['Étape valide', 'Autre étape']);
    });

    it('retourne null si strengths est absent ou vide', async () => {
      const provider = buildProvider(
        'openai',
        JSON.stringify({ ...VALID_SHEET_RESPONSE, strengths: '' }),
      );
      const service = buildService(provider);

      const result = await service.generatePersonalizedSheet({
        job: { title: 'Dev', summary: 'Dev', missions: [], skills: [] },
        answers: SAMPLE_ANSWERS,
        rank: 1,
        situation: 'lycee',
      });

      expect(result).toBeNull();
    });

    it('retourne null si watchPoints est absent ou vide', async () => {
      const provider = buildProvider(
        'openai',
        JSON.stringify({ ...VALID_SHEET_RESPONSE, watchPoints: '  ' }),
      );
      const service = buildService(provider);

      const result = await service.generatePersonalizedSheet({
        job: { title: 'Dev', summary: 'Dev', missions: [], skills: [] },
        answers: SAMPLE_ANSWERS,
        rank: 1,
        situation: 'lycee',
      });

      expect(result).toBeNull();
    });

    it('retourne null si nextSteps est absent ou tableau vide', async () => {
      const provider = buildProvider(
        'openai',
        JSON.stringify({ ...VALID_SHEET_RESPONSE, nextSteps: [] }),
      );
      const service = buildService(provider);

      const result = await service.generatePersonalizedSheet({
        job: { title: 'Dev', summary: 'Dev', missions: [], skills: [] },
        answers: SAMPLE_ANSWERS,
        rank: 1,
        situation: 'lycee',
      });

      expect(result).toBeNull();
    });

    it('retourne null si dayInLife est absent ou vide', async () => {
      const provider = buildProvider(
        'openai',
        JSON.stringify({ ...VALID_SHEET_RESPONSE, dayInLife: '' }),
      );
      const service = buildService(provider);

      const result = await service.generatePersonalizedSheet({
        job: { title: 'Dev', summary: 'Dev', missions: [], skills: [] },
        answers: SAMPLE_ANSWERS,
        rank: 1,
        situation: 'lycee',
      });

      expect(result).toBeNull();
    });

    it('retourne null si aucun provider n\'est disponible', async () => {
      const service = buildService(null);

      const result = await service.generatePersonalizedSheet({
        job: { title: 'Dev', summary: 'Dev', missions: [], skills: [] },
        answers: SAMPLE_ANSWERS,
        rank: 1,
        situation: 'lycee',
      });

      expect(result).toBeNull();
    });

    it('retourne null si l\'IA lève une exception', async () => {
      const provider = buildProvider('openai', '');
      (provider.complete as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('503'));
      const service = buildService(provider);

      const result = await service.generatePersonalizedSheet({
        job: { title: 'Dev', summary: 'Dev', missions: [], skills: [] },
        answers: SAMPLE_ANSWERS,
        rank: 1,
        situation: 'lycee',
      });

      expect(result).toBeNull();
    });

    it('accepte les situations reconnues et les traduit correctement dans le prompt', async () => {
      const provider = buildProvider('openai', JSON.stringify(VALID_SHEET_RESPONSE));
      const service = buildService(provider);

      await service.generatePersonalizedSheet({
        job: { title: 'Dev', summary: 'Dev', missions: [], skills: [] },
        answers: [],
        rank: 1,
        situation: 'etudes_longues',
      });

      const calledPrompt = (provider.complete as ReturnType<typeof vi.fn>).mock.calls[0][0].prompt;
      expect(calledPrompt).toContain('étudiant en études longues');
    });

    it('utilise le label brut si la situation est inconnue', async () => {
      const provider = buildProvider('openai', JSON.stringify(VALID_SHEET_RESPONSE));
      const service = buildService(provider);

      await service.generatePersonalizedSheet({
        job: { title: 'Dev', summary: 'Dev', missions: [], skills: [] },
        answers: [],
        rank: 1,
        situation: 'situation_inconnue',
      });

      const calledPrompt = (provider.complete as ReturnType<typeof vi.fn>).mock.calls[0][0].prompt;
      expect(calledPrompt).toContain('situation_inconnue');
    });
  });

  // ─── rankJobsForProfile ──────────────────────────────────────────────────

  describe('rankJobsForProfile', () => {
    it('retourne les scores normalisés dans [0 ; 100] pour les codes fournis', async () => {
      const provider = buildProvider(
        'openai',
        JSON.stringify({ scores: { M1805: 85, J1502: 12 } }),
      );
      const service = buildService(provider);

      const result = await service.rankJobsForProfile({
        candidates: [
          { code: 'M1805', libelle: 'Études informatique' },
          { code: 'J1502', libelle: 'Infirmier' },
        ],
        answers: SAMPLE_ANSWERS,
      });

      expect(result).toEqual({ M1805: 85, J1502: 12 });
    });

    it('clamp les scores hors bornes dans [0 ; 100]', async () => {
      const provider = buildProvider(
        'openai',
        JSON.stringify({ scores: { M1805: 150, J1502: -20 } }),
      );
      const service = buildService(provider);

      const result = await service.rankJobsForProfile({
        candidates: [
          { code: 'M1805', libelle: 'Études informatique' },
          { code: 'J1502', libelle: 'Infirmier' },
        ],
        answers: SAMPLE_ANSWERS,
      });

      expect(result).toEqual({ M1805: 100, J1502: 0 });
    });

    it('arrondit les scores flottants à l\'entier le plus proche', async () => {
      const provider = buildProvider(
        'openai',
        JSON.stringify({ scores: { M1805: 84.6, J1502: 11.2 } }),
      );
      const service = buildService(provider);

      const result = await service.rankJobsForProfile({
        candidates: [
          { code: 'M1805', libelle: 'Études informatique' },
          { code: 'J1502', libelle: 'Infirmier' },
        ],
        answers: SAMPLE_ANSWERS,
      });

      expect(result).toEqual({ M1805: 85, J1502: 11 });
    });

    it('ignore les codes retournés par l\'IA qui ne sont pas dans la liste candidates', async () => {
      const provider = buildProvider(
        'openai',
        JSON.stringify({ scores: { M1805: 85, CODE_INCONNU: 99 } }),
      );
      const service = buildService(provider);

      const result = await service.rankJobsForProfile({
        candidates: [{ code: 'M1805', libelle: 'Études informatique' }],
        answers: SAMPLE_ANSWERS,
      });

      expect(result).toEqual({ M1805: 85 });
      expect(result).not.toHaveProperty('CODE_INCONNU');
    });

    it('retourne null si aucun provider n\'est disponible', async () => {
      const service = buildService(null);

      const result = await service.rankJobsForProfile({
        candidates: [{ code: 'M1805', libelle: 'Études informatique' }],
        answers: SAMPLE_ANSWERS,
      });

      expect(result).toBeNull();
    });

    it('retourne null si la liste candidates est vide', async () => {
      const provider = buildProvider('openai', JSON.stringify({ scores: {} }));
      const service = buildService(provider);

      const result = await service.rankJobsForProfile({
        candidates: [],
        answers: SAMPLE_ANSWERS,
      });

      expect(result).toBeNull();
      expect(provider.complete).not.toHaveBeenCalled();
    });

    it('retourne null si la réponse IA ne contient pas de champ scores', async () => {
      const provider = buildProvider('openai', JSON.stringify({ autre: {} }));
      const service = buildService(provider);

      const result = await service.rankJobsForProfile({
        candidates: [{ code: 'M1805', libelle: 'Études informatique' }],
        answers: SAMPLE_ANSWERS,
      });

      expect(result).toBeNull();
    });

    it('retourne null si tous les codes de la réponse sont inconnus', async () => {
      const provider = buildProvider(
        'openai',
        JSON.stringify({ scores: { CODE_X: 80, CODE_Y: 60 } }),
      );
      const service = buildService(provider);

      const result = await service.rankJobsForProfile({
        candidates: [{ code: 'M1805', libelle: 'Études informatique' }],
        answers: SAMPLE_ANSWERS,
      });

      expect(result).toBeNull();
    });

    it('retourne null si l\'IA lève une exception', async () => {
      const provider = buildProvider('openai', '');
      (provider.complete as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('rate limit'));
      const service = buildService(provider);

      const result = await service.rankJobsForProfile({
        candidates: [{ code: 'M1805', libelle: 'Études informatique' }],
        answers: SAMPLE_ANSWERS,
      });

      expect(result).toBeNull();
    });
  });

  // ─── stripCodeFences (via askJson) ───────────────────────────────────────

  describe('nettoyage des balises markdown (code fences)', () => {
    it('nettoie les blocs ```json ... ``` avant le parsing', async () => {
      const provider = buildProvider(
        'gemini',
        '```json\n{"scores":{"M1805":90}}\n```',
      );
      const service = buildService(provider);

      const result = await service.rankJobsForProfile({
        candidates: [{ code: 'M1805', libelle: 'Études informatique' }],
        answers: SAMPLE_ANSWERS,
      });

      expect(result).toEqual({ M1805: 90 });
    });

    it('nettoie les blocs ``` ... ``` sans spécificateur de langage', async () => {
      const provider = buildProvider(
        'claude',
        '```\n{"scores":{"M1805":75}}\n```',
      );
      const service = buildService(provider);

      const result = await service.rankJobsForProfile({
        candidates: [{ code: 'M1805', libelle: 'Études informatique' }],
        answers: SAMPLE_ANSWERS,
      });

      expect(result).toEqual({ M1805: 75 });
    });

    it('traite correctement le JSON brut sans balises markdown', async () => {
      const provider = buildProvider(
        'openai',
        '{"scores":{"M1805":65}}',
      );
      const service = buildService(provider);

      const result = await service.rankJobsForProfile({
        candidates: [{ code: 'M1805', libelle: 'Études informatique' }],
        answers: SAMPLE_ANSWERS,
      });

      expect(result).toEqual({ M1805: 65 });
    });
  });
});
