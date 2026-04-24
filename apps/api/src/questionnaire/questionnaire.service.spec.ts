import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuestionnaireService } from './questionnaire.service';

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Catalogue reduit pour les tests (3 slugs suffisent)
const SLUGS = ['dev-fullstack', 'data-analyst', 'product-manager'] as const;

const jobsMock = {
  listSlugs: vi.fn().mockReturnValue([...SLUGS]),
  isValidSlug: vi.fn().mockImplementation((slug: string) =>
    (SLUGS as readonly string[]).includes(slug),
  ),
  findBySlug: vi.fn().mockImplementation((slug: string) => ({
    slug,
    title: slug,
    tagline: '',
    summary: '',
    missions: [],
    skills: [],
    formations: [],
    salaryRangeHint: '',
    workContext: '',
  })),
};

const aiMock = {
  adjustScores: vi.fn().mockResolvedValue(null),
  generateRationales: vi.fn().mockResolvedValue(null),
  chooseQuestion: vi.fn().mockResolvedValue(null),
  extractWeightsFromText: vi.fn().mockResolvedValue(null),
};

// PrismaService non utilise dans les methodes testees ici
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
    service = new QuestionnaireService(prismaMock, jobsMock as any, aiMock as any);
  });

  // ── computeBaseScores ─────────────────────────────────────────────────────

  describe('computeBaseScores', () => {
    it('initialise tous les metiers a 0 quand il ny a aucune reponse', () => {
      const result = priv(service).computeBaseScores([]);

      expect(result).toEqual({
        'dev-fullstack': 0,
        'data-analyst': 0,
        'product-manager': 0,
      });
    });

    it('accumule les poids des options QCM', () => {
      const answers = [
        { option: { jobWeights: { 'dev-fullstack': 3, 'data-analyst': 1 } }, extractedWeights: null },
        { option: { jobWeights: { 'dev-fullstack': 2 } }, extractedWeights: null },
      ];

      const result = priv(service).computeBaseScores(answers);

      expect(result['dev-fullstack']).toBe(5);
      expect(result['data-analyst']).toBe(1);
      expect(result['product-manager']).toBe(0);
    });

    it('accumule les poids extraits du texte libre', () => {
      const answers = [
        { option: null, extractedWeights: { 'data-analyst': 4, 'product-manager': 2 } },
      ];

      const result = priv(service).computeBaseScores(answers);

      expect(result['data-analyst']).toBe(4);
      expect(result['product-manager']).toBe(2);
    });

    it('ignore les slugs absents du catalogue', () => {
      const answers = [
        { option: { jobWeights: { 'slug-inexistant': 99, 'dev-fullstack': 2 } }, extractedWeights: null },
      ];

      const result = priv(service).computeBaseScores(answers);

      expect(Object.keys(result)).not.toContain('slug-inexistant');
      expect(result['dev-fullstack']).toBe(2);
    });

    it('ignore les valeurs non numeriques dans les poids', () => {
      const answers = [
        { option: { jobWeights: { 'dev-fullstack': 'beaucoup', 'data-analyst': 3 } }, extractedWeights: null },
      ];

      const result = priv(service).computeBaseScores(answers);

      expect(result['dev-fullstack']).toBe(0);
      expect(result['data-analyst']).toBe(3);
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

  // ── normalizeCondition ────────────────────────────────────────────────────

  describe('normalizeCondition', () => {
    it('retourne null pour une valeur nulle', () => {
      expect(priv(service).normalizeCondition(null)).toBeNull();
    });

    it('retourne null pour undefined', () => {
      expect(priv(service).normalizeCondition(undefined)).toBeNull();
    });

    it('retourne null pour un tableau', () => {
      expect(priv(service).normalizeCondition([])).toBeNull();
    });

    it('retourne null pour un objet vide', () => {
      expect(priv(service).normalizeCondition({})).toBeNull();
    });

    it('retourne seulement les cles dont la valeur est une string', () => {
      const input = { a: 'valeur', b: 42, c: true, d: 'ok' };

      expect(priv(service).normalizeCondition(input)).toEqual({ a: 'valeur', d: 'ok' });
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
