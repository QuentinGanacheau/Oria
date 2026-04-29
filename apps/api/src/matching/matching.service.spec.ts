import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DomainScorerService } from './domain-scorer.service';
import { JobRankerService } from './job-ranker.service';
import { MatchingService } from './matching.service';
import type { MatchingAnswer } from './matching.types';

const buildAnswer = (
  domainWeights: Record<string, number> | null,
): MatchingAnswer => ({
  question: 'Q',
  answer: 'A',
  domainWeights,
});

// ─── Mocks ───────────────────────────────────────────────────────────────────

const prismaMock = {
  romeJob: {
    findMany: vi.fn(),
  },
};

const aiMock = {
  rankJobsForProfile: vi.fn(),
};

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('MatchingService', () => {
  let service: MatchingService;

  beforeEach(() => {
    vi.clearAllMocks();
    const domainScorer = new DomainScorerService();
    const jobRanker = new JobRankerService(aiMock as any);
    service = new MatchingService(prismaMock as any, domainScorer, jobRanker);
  });

  it('retourne un tableau vide si aucun grand domaine ne ressort', async () => {
    const result = await service.findBestJobs([buildAnswer(null)]);

    expect(result).toEqual([]);
    expect(prismaMock.romeJob.findMany).not.toHaveBeenCalled();
  });

  it('retourne un tableau vide si aucun metier ROME ne correspond aux domaines', async () => {
    prismaMock.romeJob.findMany.mockResolvedValue([]);

    const result = await service.findBestJobs([buildAnswer({ M: 5 })]);

    expect(result).toEqual([]);
  });

  it('passe les top domaines au filtre Prisma', async () => {
    prismaMock.romeJob.findMany.mockResolvedValue([]);

    await service.findBestJobs(
      [buildAnswer({ M: 10, J: 5, K: 8, A: 1 })],
      { topDomainsCount: 2 },
    );

    expect(prismaMock.romeJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { codeGrandDomaine: { in: ['M', 'K'] } },
      }),
    );
  });

  it('reranke les candidats via IA et retourne le top N final', async () => {
    prismaMock.romeJob.findMany.mockResolvedValue([
      { code: 'M1805', libelle: 'Etudes informatique', codeGrandDomaine: 'M' },
      { code: 'M1801', libelle: 'Architecture SI', codeGrandDomaine: 'M' },
      { code: 'M1802', libelle: 'Conseil IT', codeGrandDomaine: 'M' },
    ]);
    aiMock.rankJobsForProfile.mockResolvedValue({
      M1801: 92,
      M1805: 78,
      M1802: 45,
    });

    const result = await service.findBestJobs([buildAnswer({ M: 5 })], {
      finalTopN: 2,
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ code: 'M1801', score: 92, rank: 1 });
    expect(result[1]).toMatchObject({ code: 'M1805', score: 78, rank: 2 });
  });

  it('utilise le fallback si IA indisponible (rankJobsForProfile renvoie null)', async () => {
    prismaMock.romeJob.findMany.mockResolvedValue([
      { code: 'M1805', libelle: 'Etudes informatique', codeGrandDomaine: 'M' },
      { code: 'M1801', libelle: 'Architecture SI', codeGrandDomaine: 'M' },
    ]);
    aiMock.rankJobsForProfile.mockResolvedValue(null);

    const result = await service.findBestJobs([buildAnswer({ M: 5 })]);

    expect(result).toHaveLength(2);
    // Fallback : score uniforme à 50, ordre d'entrée préservé
    expect(result[0]).toMatchObject({ code: 'M1805', score: 50, rank: 1 });
    expect(result[1]).toMatchObject({ code: 'M1801', score: 50, rank: 2 });
  });
});
