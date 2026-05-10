import { describe, it, expect, beforeEach } from 'vitest';
import { DomainScorerService } from './domain-scorer.service';
import type { MatchingAnswer } from './matching.types';

const buildAnswer = (
  domainWeights: Record<string, number> | null,
): MatchingAnswer => ({
  question: 'Question test',
  answer: 'Reponse test',
  domainWeights,
});

describe('DomainScorerService', () => {
  let service: DomainScorerService;

  beforeEach(() => {
    service = new DomainScorerService();
  });

  // ── compute ──────────────────────────────────────────────────────────────

  describe('compute', () => {
    it('retourne un objet vide pour aucune reponse', () => {
      expect(service.compute([])).toEqual({});
    });

    it('additionne les poids de plusieurs reponses', () => {
      const answers = [
        buildAnswer({ M: 3, J: 2 }),
        buildAnswer({ M: 1, K: 4 }),
      ];

      expect(service.compute(answers)).toEqual({ M: 4, J: 2, K: 4 });
    });

    it('ignore les reponses sans domainWeights (texte libre par exemple)', () => {
      const answers = [
        buildAnswer({ M: 3 }),
        buildAnswer(null),
        buildAnswer({ J: 2 }),
      ];

      expect(service.compute(answers)).toEqual({ M: 3, J: 2 });
    });

    it('ignore les valeurs non numeriques', () => {
      const answers = [
        buildAnswer({ M: 3, J: NaN, K: 'beaucoup' as unknown as number }),
      ];

      expect(service.compute(answers)).toEqual({ M: 3 });
    });
  });

  // ── topDomains ───────────────────────────────────────────────────────────

  describe('topDomains', () => {
    it('retourne les N domaines avec les plus gros scores', () => {
      const scores = { M: 10, J: 5, K: 8, A: 1 };

      expect(service.topDomains(scores, 2)).toEqual(['M', 'K']);
    });

    it('exclut les domaines avec un score nul ou negatif', () => {
      const scores = { M: 5, J: 0, K: 3 };

      expect(service.topDomains(scores, 5)).toEqual(['M', 'K']);
    });

    it('retourne au plus N domaines meme si plus disponibles', () => {
      const scores = { M: 5, J: 4, K: 3, A: 2 };

      expect(service.topDomains(scores, 2)).toEqual(['M', 'J']);
    });

    it('retourne un tableau vide si aucun score positif', () => {
      const scores = { M: 0, J: 0 };

      expect(service.topDomains(scores, 3)).toEqual([]);
    });
  });
});
