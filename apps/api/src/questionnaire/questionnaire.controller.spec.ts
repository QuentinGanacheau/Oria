import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuestionnaireController } from './questionnaire.controller';
import type { AnswerNextDto } from './dto/answer-next.dto';
import type { FinishSessionDto } from './dto/finish-session.dto';
import type { StartSessionDto } from './dto/start-session.dto';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const buildPublicQuestion = () => ({
  id: 'situation',
  text: 'Quelle est votre situation actuelle ?',
  type: 'SINGLE_CHOICE' as const,
  options: [
    { id: 'employe', label: 'En emploi' },
    { id: 'chomeur', label: 'En recherche' },
  ],
});

const buildMatchOutput = () => ({
  job: {
    slug: 'M1805',
    title: 'Études informatiques',
    tagline: 'Informatique',
    summary: 'Résumé',
    missions: [],
    skills: [],
    formations: [],
    salaryRangeHint: '',
    workContext: '',
  },
  score: 85,
  scorePercent: 85,
  rationale: 'Profil très adapté.',
});

// ─── Mock service ─────────────────────────────────────────────────────────────

const questionnaireMock = {
  startSession: vi.fn(),
  answerAndGetNext: vi.fn(),
  finishSession: vi.fn(),
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('QuestionnaireController', () => {
  let controller: QuestionnaireController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new QuestionnaireController(questionnaireMock as any);
  });

  // ─── POST /questionnaire/start ────────────────────────────────────────────

  describe('start()', () => {
    it('délègue au service avec les métadonnées fournies', async () => {
      const question = buildPublicQuestion();
      questionnaireMock.startSession.mockResolvedValue({
        sessionId: 'sess-001',
        complete: false,
        question,
      });

      const body: StartSessionDto = { metadata: { source: 'web' } };
      const result = await controller.start(body);

      expect(questionnaireMock.startSession).toHaveBeenCalledWith({
        source: 'web',
      });
      expect(result).toMatchObject({
        sessionId: 'sess-001',
        complete: false,
        question,
      });
    });

    it('appelle le service avec undefined si metadata est absent', async () => {
      questionnaireMock.startSession.mockResolvedValue({
        sessionId: 'sess-002',
        complete: false,
        question: buildPublicQuestion(),
      });

      const body: StartSessionDto = {};
      await controller.start(body);

      expect(questionnaireMock.startSession).toHaveBeenCalledWith(undefined);
    });

    it('retourne complete: true si le questionnaire est directement terminé', async () => {
      questionnaireMock.startSession.mockResolvedValue({
        sessionId: 'sess-003',
        complete: true,
        question: null,
      });

      const result = await controller.start({});

      expect(result.complete).toBe(true);
      expect(result.question).toBeNull();
    });

    it('propage l erreur si le service échoue', async () => {
      questionnaireMock.startSession.mockRejectedValue(new Error('DB error'));

      await expect(controller.start({})).rejects.toThrow('DB error');
    });
  });

  // ─── POST /questionnaire/next ─────────────────────────────────────────────

  describe('next()', () => {
    it('transmet le DTO complet au service et retourne la prochaine question', async () => {
      const nextQuestion = buildPublicQuestion();
      questionnaireMock.answerAndGetNext.mockResolvedValue({
        complete: false,
        question: nextQuestion,
      });

      const body: AnswerNextDto = {
        sessionId: 'sess-001',
        questionKey: 'situation',
        optionKey: 'employe',
      };
      const result = await controller.next(body);

      expect(questionnaireMock.answerAndGetNext).toHaveBeenCalledWith(body);
      expect(result).toEqual({ complete: false, question: nextQuestion });
    });

    it('retourne complete: true et question: null quand c est la dernière réponse', async () => {
      questionnaireMock.answerAndGetNext.mockResolvedValue({
        complete: true,
        question: null,
      });

      const body: AnswerNextDto = {
        sessionId: 'sess-001',
        questionKey: 'objectif',
        optionKey: 'emploi',
      };
      const result = await controller.next(body);

      expect(result.complete).toBe(true);
      expect(result.question).toBeNull();
    });

    it('transmet le freeText au service pour une question texte libre', async () => {
      questionnaireMock.answerAndGetNext.mockResolvedValue({
        complete: false,
        question: null,
      });

      const body: AnswerNextDto = {
        sessionId: 'sess-001',
        questionKey: 'motivation',
        freeText: 'J aime travailler en équipe sur des projets techniques.',
      };
      await controller.next(body);

      expect(questionnaireMock.answerAndGetNext).toHaveBeenCalledWith(body);
    });

    it('propage la NotFoundException si la session est introuvable', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      questionnaireMock.answerAndGetNext.mockRejectedValue(
        new NotFoundException('Session introuvable'),
      );

      const body: AnswerNextDto = {
        sessionId: 'inexistant',
        questionKey: 'situation',
        optionKey: 'employe',
      };

      await expect(controller.next(body)).rejects.toThrow(NotFoundException);
    });

    it('propage la BadRequestException si la session est déjà terminée', async () => {
      const { BadRequestException } = await import('@nestjs/common');
      questionnaireMock.answerAndGetNext.mockRejectedValue(
        new BadRequestException('La session est déjà terminée.'),
      );

      const body: AnswerNextDto = {
        sessionId: 'sess-termine',
        questionKey: 'situation',
        optionKey: 'employe',
      };

      await expect(controller.next(body)).rejects.toThrow(BadRequestException);
    });
  });

  // ─── POST /questionnaire/match ────────────────────────────────────────────

  describe('finish()', () => {
    it('retourne les résultats de matching avec sessionId et matches', async () => {
      const matches = [buildMatchOutput()];
      questionnaireMock.finishSession.mockResolvedValue({
        sessionId: 'sess-001',
        matches,
      });

      const body: FinishSessionDto = { sessionId: 'sess-001' };
      const result = await controller.finish(body);

      expect(questionnaireMock.finishSession).toHaveBeenCalledWith('sess-001');
      expect(result).toMatchObject({ sessionId: 'sess-001', matches });
    });

    it('retourne matches vide si aucun métier n a été trouvé', async () => {
      questionnaireMock.finishSession.mockResolvedValue({
        sessionId: 'sess-002',
        matches: [],
      });

      const body: FinishSessionDto = { sessionId: 'sess-002' };
      const result = await controller.finish(body);

      expect(result.matches).toEqual([]);
    });

    it('propage la NotFoundException si la session est introuvable', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      questionnaireMock.finishSession.mockRejectedValue(
        new NotFoundException('Session introuvable'),
      );

      await expect(
        controller.finish({ sessionId: 'inexistant' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('propage la BadRequestException si aucune réponse n a été enregistrée', async () => {
      const { BadRequestException } = await import('@nestjs/common');
      questionnaireMock.finishSession.mockRejectedValue(
        new BadRequestException('Aucune réponse enregistrée.'),
      );

      await expect(
        controller.finish({ sessionId: 'sess-vide' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('propage la ServiceUnavailableException si l IA est indisponible', async () => {
      const { ServiceUnavailableException } = await import('@nestjs/common');
      questionnaireMock.finishSession.mockRejectedValue(
        new ServiceUnavailableException(
          'Notre moteur de recommandation est temporairement indisponible.',
        ),
      );

      await expect(
        controller.finish({ sessionId: 'sess-ia-down' }),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('transmet uniquement le sessionId du DTO au service', async () => {
      questionnaireMock.finishSession.mockResolvedValue({
        sessionId: 'sess-xyz',
        matches: [],
      });

      await controller.finish({ sessionId: 'sess-xyz' });

      expect(questionnaireMock.finishSession).toHaveBeenCalledWith('sess-xyz');
      expect(questionnaireMock.finishSession).toHaveBeenCalledOnce();
    });
  });
});
