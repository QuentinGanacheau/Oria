import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JobRankerService } from './job-ranker.service';
import type { JobCandidate, MatchingAnswer } from './matching.types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const buildCandidate = (code: string, libelle: string): JobCandidate => ({
  code,
  libelle,
});

const buildAnswer = (question = 'Q', answer = 'A'): MatchingAnswer => ({
  question,
  answer,
  domainWeights: null,
});

// ─── Mock IA ─────────────────────────────────────────────────────────────────

const aiMock = {
  rankJobsForProfile: vi.fn(),
};

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('JobRankerService', () => {
  let service: JobRankerService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new JobRankerService(aiMock as any);
  });

  // ─── Cas limite : liste vide ──────────────────────────────────────────────

  describe('liste de candidats vide', () => {
    it('retourne un tableau vide sans appeler l IA', async () => {
      const result = await service.rank([], [buildAnswer()]);

      expect(result).toEqual([]);
      expect(aiMock.rankJobsForProfile).not.toHaveBeenCalled();
    });
  });

  // ─── Appel IA ────────────────────────────────────────────────────────────

  describe('appel à l IA', () => {
    it('transmet uniquement code et libelle à l IA', async () => {
      const candidates: JobCandidate[] = [
        { code: 'M1805', libelle: 'Etudes informatique', codeGrandDomaine: 'M', definition: 'def' },
      ];
      aiMock.rankJobsForProfile.mockResolvedValue({ M1805: 80 });

      await service.rank(candidates, [buildAnswer()]);

      expect(aiMock.rankJobsForProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          candidates: [{ code: 'M1805', libelle: 'Etudes informatique' }],
        }),
      );
    });

    it('transmet les champs question et answer des reponses à l IA', async () => {
      const candidates = [buildCandidate('M1805', 'Etudes informatique')];
      const answers: MatchingAnswer[] = [
        { question: 'Quelle est votre passion ?', answer: 'La tech', domainWeights: { M: 5 } },
      ];
      aiMock.rankJobsForProfile.mockResolvedValue({ M1805: 80 });

      await service.rank(candidates, answers);

      expect(aiMock.rankJobsForProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          answers: [{ question: 'Quelle est votre passion ?', answer: 'La tech' }],
        }),
      );
    });
  });

  // ─── IA indisponible ─────────────────────────────────────────────────────

  describe('IA indisponible ou en erreur', () => {
    it('retourne null si l IA retourne null', async () => {
      const candidates = [buildCandidate('M1805', 'Etudes informatique')];
      aiMock.rankJobsForProfile.mockResolvedValue(null);

      const result = await service.rank(candidates, [buildAnswer()]);

      expect(result).toBeNull();
    });
  });

  // ─── Tri et classement ───────────────────────────────────────────────────

  describe('tri et attribution des rangs', () => {
    it('trie les candidats par score décroissant', async () => {
      const candidates = [
        buildCandidate('M1805', 'Etudes informatique'),
        buildCandidate('M1801', 'Architecture SI'),
        buildCandidate('M1802', 'Conseil IT'),
      ];
      aiMock.rankJobsForProfile.mockResolvedValue({
        M1805: 78,
        M1801: 92,
        M1802: 45,
      });

      const result = await service.rank(candidates, [buildAnswer()]);

      expect(result).not.toBeNull();
      expect(result![0].code).toBe('M1801');
      expect(result![1].code).toBe('M1805');
      expect(result![2].code).toBe('M1802');
    });

    it('attribue des rangs consécutifs à partir de 1', async () => {
      const candidates = [
        buildCandidate('M1805', 'Etudes informatique'),
        buildCandidate('M1801', 'Architecture SI'),
        buildCandidate('M1802', 'Conseil IT'),
      ];
      aiMock.rankJobsForProfile.mockResolvedValue({
        M1805: 78,
        M1801: 92,
        M1802: 45,
      });

      const result = await service.rank(candidates, [buildAnswer()]);

      expect(result![0].rank).toBe(1);
      expect(result![1].rank).toBe(2);
      expect(result![2].rank).toBe(3);
    });

    it('conserve le code et le libelle dans les résultats', async () => {
      const candidates = [
        buildCandidate('M1801', 'Architecture SI'),
      ];
      aiMock.rankJobsForProfile.mockResolvedValue({ M1801: 88 });

      const result = await service.rank(candidates, [buildAnswer()]);

      expect(result![0]).toMatchObject({
        code: 'M1801',
        libelle: 'Architecture SI',
        score: 88,
        rank: 1,
      });
    });

    it('attribue un score de 0 si le code n est pas dans la réponse IA', async () => {
      const candidates = [
        buildCandidate('M1801', 'Architecture SI'),
        buildCandidate('M9999', 'Métier inconnu'),
      ];
      // L'IA ne retourne pas de score pour M9999
      aiMock.rankJobsForProfile.mockResolvedValue({ M1801: 75 });

      const result = await service.rank(candidates, [buildAnswer()]);

      expect(result).not.toBeNull();
      const inconnu = result!.find((j) => j.code === 'M9999');
      expect(inconnu).toBeDefined();
      expect(inconnu!.score).toBe(0);
    });

    it('place les candidats sans score IA après ceux avec score', async () => {
      const candidates = [
        buildCandidate('M1801', 'Architecture SI'),
        buildCandidate('M9999', 'Métier sans score'),
      ];
      aiMock.rankJobsForProfile.mockResolvedValue({ M1801: 75 });

      const result = await service.rank(candidates, [buildAnswer()]);

      expect(result![0].code).toBe('M1801');
      expect(result![1].code).toBe('M9999');
    });

    it('gère correctement un seul candidat', async () => {
      const candidates = [buildCandidate('M1805', 'Etudes informatique')];
      aiMock.rankJobsForProfile.mockResolvedValue({ M1805: 95 });

      const result = await service.rank(candidates, [buildAnswer()]);

      expect(result).toHaveLength(1);
      expect(result![0]).toMatchObject({ code: 'M1805', score: 95, rank: 1 });
    });

    it('gère un score de 0 attribué explicitement par l IA', async () => {
      const candidates = [
        buildCandidate('M1801', 'Architecture SI'),
        buildCandidate('M1802', 'Conseil IT'),
      ];
      aiMock.rankJobsForProfile.mockResolvedValue({ M1801: 70, M1802: 0 });

      const result = await service.rank(candidates, [buildAnswer()]);

      expect(result![0].code).toBe('M1801');
      expect(result![1].score).toBe(0);
    });
  });

  // ─── Nombre de résultats ─────────────────────────────────────────────────

  describe('nombre de résultats retournés', () => {
    it('retourne autant de métiers que de candidats fournis', async () => {
      const candidates = [
        buildCandidate('M1801', 'Architecture SI'),
        buildCandidate('M1802', 'Conseil IT'),
        buildCandidate('M1805', 'Etudes informatique'),
      ];
      aiMock.rankJobsForProfile.mockResolvedValue({
        M1801: 90,
        M1802: 60,
        M1805: 75,
      });

      const result = await service.rank(candidates, [buildAnswer()]);

      expect(result).toHaveLength(3);
    });
  });
});
