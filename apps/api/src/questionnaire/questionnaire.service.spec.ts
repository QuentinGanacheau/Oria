import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuestionnaireService } from './questionnaire.service';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const jobsMock = {
  findAll: vi.fn(),
  findBySlug: vi.fn(),
  getPersonalizedSheet: vi.fn(),
};

const aiMock = {
  adjustScores: vi.fn().mockResolvedValue(null),
  generateRationales: vi.fn().mockResolvedValue(null),
  chooseQuestion: vi.fn().mockResolvedValue(null),
};

const matchingMock = {
  findBestJobs: vi.fn().mockResolvedValue([]),
};

const prismaMock = {} as any;

// ─── Helper ───────────────────────────────────────────────────────────────────

/** Acces aux methodes privees sans TypeScript — pattern standard pour unit tests. */
function priv(service: QuestionnaireService) {
  return service as any;
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('QuestionnaireService', () => {
  let service: QuestionnaireService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new QuestionnaireService(
      prismaMock,
      jobsMock as any,
      aiMock as any,
      matchingMock as any,
    );
  });

  // ── parseDomainWeights ────────────────────────────────────────────────────

  describe('parseDomainWeights', () => {
    it('retourne null pour une valeur nulle ou non objet', () => {
      expect(priv(service).parseDomainWeights(null)).toBeNull();
      expect(priv(service).parseDomainWeights('truc')).toBeNull();
      expect(priv(service).parseDomainWeights(42)).toBeNull();
    });

    it('retourne null pour un objet sans valeur numerique valide', () => {
      expect(priv(service).parseDomainWeights({ M: 'beaucoup', J: NaN })).toBeNull();
    });

    it('garde uniquement les valeurs numeriques valides', () => {
      const result = priv(service).parseDomainWeights({ M: 3, J: NaN, K: 'oups', D: 2 });

      expect(result).toEqual({ M: 3, D: 2 });
    });
  });

  // ── shouldAskQuestion ─────────────────────────────────────────────────────

  describe('shouldAskQuestion', () => {
    it('retourne true quand aucune condition nest definie', () => {
      const q = { askIfEquals: null, askIfNotEquals: null };
      const answered = new Map<string, string>();

      expect(priv(service).shouldAskQuestion(q, answered)).toBe(true);
    });

    it('retourne true quand la condition askIfEquals est satisfaite', () => {
      const q = { askIfEquals: { situation: 'lycee' }, askIfNotEquals: null };
      const answered = new Map([['situation', 'lycee']]);

      expect(priv(service).shouldAskQuestion(q, answered)).toBe(true);
    });

    it('retourne false quand la condition askIfEquals nest pas satisfaite', () => {
      const q = { askIfEquals: { situation: 'lycee' }, askIfNotEquals: null };
      const answered = new Map([['situation', 'actif']]);

      expect(priv(service).shouldAskQuestion(q, answered)).toBe(false);
    });

    it('retourne false quand la condition askIfNotEquals bloque la question', () => {
      const q = { askIfEquals: null, askIfNotEquals: { situation: 'lycee' } };
      const answered = new Map([['situation', 'lycee']]);

      expect(priv(service).shouldAskQuestion(q, answered)).toBe(false);
    });

    it('retourne true quand la condition askIfNotEquals nest pas declenchee', () => {
      const q = { askIfEquals: null, askIfNotEquals: { situation: 'lycee' } };
      const answered = new Map([['situation', 'actif']]);

      expect(priv(service).shouldAskQuestion(q, answered)).toBe(true);
    });
  });

  // ── normalizeStringCondition ──────────────────────────────────────────────

  describe('normalizeStringCondition', () => {
    it('retourne null pour une valeur nulle', () => {
      expect(priv(service).normalizeStringCondition(null)).toBeNull();
    });

    it('retourne null pour undefined', () => {
      expect(priv(service).normalizeStringCondition(undefined)).toBeNull();
    });

    it('retourne null pour un tableau', () => {
      expect(priv(service).normalizeStringCondition([])).toBeNull();
    });

    it('retourne null pour un objet vide', () => {
      expect(priv(service).normalizeStringCondition({})).toBeNull();
    });

    it('retourne seulement les cles dont la valeur est une string', () => {
      const input = { a: 'valeur', b: 42, c: true, d: 'ok' };

      expect(priv(service).normalizeStringCondition(input)).toEqual({ a: 'valeur', d: 'ok' });
    });
  });

  // ── normalizeArrayCondition ───────────────────────────────────────────────

  describe('normalizeArrayCondition', () => {
    it('retourne null pour une valeur nulle', () => {
      expect(priv(service).normalizeArrayCondition(null)).toBeNull();
    });

    it('retourne null pour un objet vide', () => {
      expect(priv(service).normalizeArrayCondition({})).toBeNull();
    });

    it('retourne null si le tableau ne contient que des non-strings', () => {
      expect(priv(service).normalizeArrayCondition({ situation: [1, true] })).toBeNull();
    });

    it('retourne les tableaux de strings valides', () => {
      const input = { situation: ['actif', 'reconversion'] };
      expect(priv(service).normalizeArrayCondition(input)).toEqual({
        situation: ['actif', 'reconversion'],
      });
    });

    it('filtre les valeurs non-string dans le tableau', () => {
      const input = { situation: ['actif', 42, 'reconversion', true] };
      expect(priv(service).normalizeArrayCondition(input)).toEqual({
        situation: ['actif', 'reconversion'],
      });
    });
  });

  // ── shouldAskQuestion (askIfIn / askIfNotIn) ──────────────────────────────

  describe('shouldAskQuestion avec askIfIn et askIfNotIn', () => {
    const makeQ = (overrides: object) => ({
      askIfEquals: null,
      askIfNotEquals: null,
      askIfIn: null,
      askIfNotIn: null,
      ...overrides,
    });

    it('askIfIn : retourne true si la reponse est dans le tableau', () => {
      const answered = new Map([['situation', 'actif']]);
      const q = makeQ({ askIfIn: { situation: ['actif', 'reconversion'] } });

      expect(priv(service).shouldAskQuestion(q, answered)).toBe(true);
    });

    it('askIfIn : retourne false si la reponse nest pas dans le tableau', () => {
      const answered = new Map([['situation', 'lycee']]);
      const q = makeQ({ askIfIn: { situation: ['actif', 'reconversion'] } });

      expect(priv(service).shouldAskQuestion(q, answered)).toBe(false);
    });

    it('askIfIn : retourne false si la question clee na pas encore de reponse', () => {
      const answered = new Map<string, string>();
      const q = makeQ({ askIfIn: { situation: ['actif', 'reconversion'] } });

      expect(priv(service).shouldAskQuestion(q, answered)).toBe(false);
    });

    it('askIfNotIn : retourne true si la reponse nest pas dans le tableau bloque', () => {
      const answered = new Map([['situation', 'lycee']]);
      const q = makeQ({ askIfNotIn: { situation: ['actif', 'reconversion'] } });

      expect(priv(service).shouldAskQuestion(q, answered)).toBe(true);
    });

    it('askIfNotIn : retourne false si la reponse est dans le tableau bloque', () => {
      const answered = new Map([['situation', 'actif']]);
      const q = makeQ({ askIfNotIn: { situation: ['actif', 'reconversion'] } });

      expect(priv(service).shouldAskQuestion(q, answered)).toBe(false);
    });
  });

  // ── varianceScore ─────────────────────────────────────────────────────────

  describe('varianceScore', () => {
    it('retourne la constante proxy pour une question FREE_TEXT', () => {
      const proxy = (QuestionnaireService as any).FREE_TEXT_VARIANCE_PROXY;
      const q = { type: 'FREE_TEXT', options: [] };

      expect(priv(service).varianceScore(q)).toBe(proxy);
    });

    it('retourne 0 pour une question sans options', () => {
      const q = { type: 'SINGLE_CHOICE', options: [] };

      expect(priv(service).varianceScore(q)).toBe(0);
    });

    it('retourne 0 pour une question avec une seule valeur de poids', () => {
      const q = {
        type: 'SINGLE_CHOICE',
        options: [{ jobWeights: { 'dev-fullstack': 3 } }],
      };

      expect(priv(service).varianceScore(q)).toBe(0);
    });

    it('retourne une variance strictement positive pour des poids varies', () => {
      const q = {
        type: 'SINGLE_CHOICE',
        options: [
          { jobWeights: { 'dev-fullstack': 5 } },
          { jobWeights: { 'dev-fullstack': 1 } },
        ],
      };

      expect(priv(service).varianceScore(q)).toBeGreaterThan(0);
    });
  });
});
