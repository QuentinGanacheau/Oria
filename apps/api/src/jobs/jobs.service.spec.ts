import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { JobsService } from './jobs.service';

// ─── Données de référence ────────────────────────────────────────────────────

const fakeRomeJob = {
  code: 'M1805',
  libelle: 'Études et développement informatique',
  definition: 'Conçoit, développe et met au point des projets logiciels.',
  codeGrandDomaine: 'M',
  libelleGrandDomaine: "Support à l'entreprise",
  codeDomaine: 'M18',
  libelleDomaine: 'Systèmes d\'information et de télécommunication',
  competencesSavoirs: [
    { libelle: 'Algorithmique' },
    { libelle: 'Architectures logicielles' },
  ],
  competencesSavoirFaire: [
    { libelle: 'Concevoir et développer une solution digitale' },
    { libelle: 'Réaliser des tests unitaires' },
  ],
  contextesTravail: [
    { libelle: 'En équipe' },
    { libelle: 'Sur écran' },
  ],
  offerCount: 4200,
  recruitmentLevel: 'high',
  syncedAt: new Date(),
};

// ─── Mocks ───────────────────────────────────────────────────────────────────

const prismaMock = {
  romeJob: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
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

  // ── Lecture catalogue ─────────────────────────────────────────────────────

  describe('findAll', () => {
    it('retourne tous les metiers ROME adaptes en JobProfile', async () => {
      prismaMock.romeJob.findMany.mockResolvedValue([fakeRomeJob]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        slug: 'M1805',
        title: 'Études et développement informatique',
        tagline: 'Systèmes d\'information et de télécommunication',
      });
    });
  });

  describe('findBySlug', () => {
    it('retourne le JobProfile correspondant au code ROME', async () => {
      prismaMock.romeJob.findUnique.mockResolvedValue(fakeRomeJob);

      const result = await service.findBySlug('M1805');

      expect(result.slug).toBe('M1805');
      expect(result.missions).toEqual([
        'Concevoir et développer une solution digitale',
        'Réaliser des tests unitaires',
      ]);
      expect(result.skills).toEqual([
        'Algorithmique',
        'Architectures logicielles',
      ]);
      expect(result.workContext).toBe('En équipe · Sur écran');
      expect(result.recruitmentLevel).toBe('high');
      expect(result.offerCount).toBe(4200);
    });

    it('leve NotFoundException si le code est inconnu', async () => {
      prismaMock.romeJob.findUnique.mockResolvedValue(null);

      await expect(service.findBySlug('XXXXX')).rejects.toThrow(NotFoundException);
    });
  });

  // ── Fiche personnalisée ───────────────────────────────────────────────────

  describe('getPersonalizedSheet', () => {
    const sessionId = 'session-test-123';
    const code = 'M1805';

    const fakeAnswers = [
      {
        question: { key: 'situation', text: 'Quelle est ta situation ?' },
        option: { key: 'actif', label: 'En poste' },
        freeText: null,
      },
    ];

    const generated = {
      strengths: 'Tu aimeras la creativite.',
      watchPoints: 'Attention au rythme.',
      nextSteps: ['Etape 1', 'Etape 2'],
      dayInLife: 'Une journee commence par...',
    };

    it('retourne le contenu en cache si deja genere', async () => {
      prismaMock.romeJob.findUnique.mockResolvedValue(fakeRomeJob);
      prismaMock.matchResult.findFirst.mockResolvedValue({
        id: 'match-1',
        rank: 1,
        personalizedContent: generated,
      });

      const result = await service.getPersonalizedSheet(code, sessionId);

      expect(result).toEqual(generated);
      expect(aiMock.generatePersonalizedSheet).not.toHaveBeenCalled();
    });

    it('genere via IA et met en cache si absent', async () => {
      prismaMock.romeJob.findUnique.mockResolvedValue(fakeRomeJob);
      prismaMock.matchResult.findFirst.mockResolvedValue({
        id: 'match-1',
        rank: 1,
        personalizedContent: null,
      });
      prismaMock.sessionAnswer.findMany.mockResolvedValue(fakeAnswers);
      aiMock.generatePersonalizedSheet.mockResolvedValue(generated);

      const result = await service.getPersonalizedSheet(code, sessionId);

      expect(result).toEqual(generated);
      expect(prismaMock.matchResult.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ personalizedContent: generated }),
        }),
      );
    });

    it('retourne null si aucun MatchResult trouve', async () => {
      prismaMock.romeJob.findUnique.mockResolvedValue(fakeRomeJob);
      prismaMock.matchResult.findFirst.mockResolvedValue(null);

      const result = await service.getPersonalizedSheet(code, sessionId);

      expect(result).toBeNull();
    });

    it('retourne null sans stocker si IA est indisponible', async () => {
      prismaMock.romeJob.findUnique.mockResolvedValue(fakeRomeJob);
      prismaMock.matchResult.findFirst.mockResolvedValue({
        id: 'match-1',
        rank: 2,
        personalizedContent: null,
      });
      prismaMock.sessionAnswer.findMany.mockResolvedValue(fakeAnswers);
      aiMock.generatePersonalizedSheet.mockResolvedValue(null);

      const result = await service.getPersonalizedSheet(code, sessionId);

      expect(result).toBeNull();
      expect(prismaMock.matchResult.update).not.toHaveBeenCalled();
    });
  });
});
