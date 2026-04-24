import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JOBS } from './jobs.data';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const prismaMock = {
  matchResult: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  sessionAnswer: {
    findMany: vi.fn(),
  },
};

const aiMock = {
  generatePersonalizedSheet: vi.fn(),
};

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('JobsService', () => {
  let service: JobsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new JobsService(prismaMock as any, aiMock as any);
  });

  // ── Catalogue statique ────────────────────────────────────────────────────

  describe('findAll', () => {
    it('retourne la liste complete des metiers', () => {
      const result = service.findAll();
      expect(result).toHaveLength(JOBS.length);
      // Référence identique : pas de copie inutile
      expect(result).toBe(JOBS);
    });
  });

  describe('findBySlug', () => {
    it('retourne le metier correspondant au slug', () => {
      const target = JOBS[0];
      const result = service.findBySlug(target.slug);
      expect(result.slug).toBe(target.slug);
      expect(result.title).toBeDefined();
    });

    it('leve NotFoundException pour un slug inconnu', () => {
      expect(() => service.findBySlug('slug-qui-nexiste-pas')).toThrow(NotFoundException);
    });
  });

  describe('isValidSlug', () => {
    it('retourne true pour un slug du catalogue', () => {
      expect(service.isValidSlug(JOBS[0].slug)).toBe(true);
    });

    it('retourne false pour un slug absent du catalogue', () => {
      expect(service.isValidSlug('slug-inconnu')).toBe(false);
    });
  });

  describe('listSlugs', () => {
    it('retourne tous les slugs du catalogue', () => {
      const slugs = service.listSlugs();
      expect(slugs).toHaveLength(JOBS.length);
      expect(slugs).toContain(JOBS[0].slug);
      expect(slugs).toContain(JOBS[JOBS.length - 1].slug);
    });
  });

  // ── Fiche personnalisée (cache-aside) ─────────────────────────────────────

  describe('getPersonalizedSheet', () => {
    const slug = JOBS[0].slug;
    const sessionId = 'session-test-123';

    const fakeAnswers = [
      {
        question: { key: 'situation', text: 'Quelle est ta situation ?' },
        option: { key: 'actif', label: 'En poste' },
        freeText: null,
      },
    ];

    const generatedContent = {
      strengths: 'Tu aimeras la creativite.',
      watchPoints: 'Attention au rythme.',
      nextSteps: ['Etape 1', 'Etape 2', 'Etape 3'],
      dayInLife: 'Une journee commence par…',
    };

    it('retourne le contenu depuis le cache DB sans appeler IA', async () => {
      prismaMock.matchResult.findFirst.mockResolvedValue({
        id: 'match-1',
        rank: 1,
        personalizedContent: generatedContent,
      });

      const result = await service.getPersonalizedSheet(slug, sessionId);

      expect(result).toEqual(generatedContent);
      expect(aiMock.generatePersonalizedSheet).not.toHaveBeenCalled();
    });

    it('genere le contenu via IA et le met en cache si absent', async () => {
      prismaMock.matchResult.findFirst.mockResolvedValue({
        id: 'match-1',
        rank: 1,
        personalizedContent: null,
      });
      prismaMock.sessionAnswer.findMany.mockResolvedValue(fakeAnswers);
      aiMock.generatePersonalizedSheet.mockResolvedValue(generatedContent);
      prismaMock.matchResult.update.mockResolvedValue({});

      const result = await service.getPersonalizedSheet(slug, sessionId);

      expect(result).toEqual(generatedContent);
      expect(aiMock.generatePersonalizedSheet).toHaveBeenCalledOnce();
      expect(prismaMock.matchResult.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ personalizedContent: generatedContent }),
        }),
      );
    });

    it('retourne null si aucun MatchResult trouve pour cette session', async () => {
      prismaMock.matchResult.findFirst.mockResolvedValue(null);

      const result = await service.getPersonalizedSheet(slug, sessionId);

      expect(result).toBeNull();
    });

    it('retourne null sans stocker si IA est indisponible (degradation propre)', async () => {
      prismaMock.matchResult.findFirst.mockResolvedValue({
        id: 'match-1',
        rank: 2,
        personalizedContent: null,
      });
      prismaMock.sessionAnswer.findMany.mockResolvedValue(fakeAnswers);
      aiMock.generatePersonalizedSheet.mockResolvedValue(null);

      const result = await service.getPersonalizedSheet(slug, sessionId);

      expect(result).toBeNull();
      expect(prismaMock.matchResult.update).not.toHaveBeenCalled();
    });

    it('leve NotFoundException si le slug nexiste pas', async () => {
      await expect(
        service.getPersonalizedSheet('slug-inconnu', sessionId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
