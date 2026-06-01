import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
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
  rankJobsWithPreferences: vi.fn().mockResolvedValue(null),
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

  // ── generateNextBatch (swipe deck — batches progressifs) ──────────────────

  describe('generateNextBatch', () => {
    type FakeBatch = {
      batchNumber: number;
      ratingsAtCreation: number;
      matches: Array<{ job: { slug: string } }>;
    };

    /** Construit une session minimale avec le shape attendu par le service. */
    function makeSession(overrides: {
      isPaid?: boolean;
      ratings?: Array<{ jobSlug: string; rating: string; reason?: string | null }>;
      matches?: Array<{ jobSlug: string }>;
      refinedBatches?: FakeBatch[];
    }) {
      return {
        id: 'sess-1',
        isPaid: overrides.isPaid ?? true,
        ratings: (overrides.ratings ?? []).map((r) => ({
          jobSlug: r.jobSlug,
          rating: r.rating,
          reason: r.reason ?? null,
        })),
        matches: overrides.matches ?? [],
        refinedBatches: overrides.refinedBatches ?? [],
        answers: [
          {
            question: { key: 'situation', text: 'Ta situation ?' },
            option: { key: 'actif', label: 'En poste' },
            freeText: null,
            followUpQuestion: null,
            followUpAnswer: null,
          },
        ],
      };
    }

    /** Prisma mock : findUnique renvoie `session`, candidats configurables. */
    function makePrisma(
      session: ReturnType<typeof makeSession>,
      candidates: Array<{ code: string; libelle: string }>,
    ) {
      return {
        questionnaireSession: {
          findUnique: vi.fn().mockResolvedValue(session),
        },
        romeJob: {
          findMany: vi.fn().mockImplementation((args: any) => {
            // La requête des métiers notés sélectionne codeGrandDomaine.
            if (args?.select?.codeGrandDomaine) {
              return Promise.resolve(
                session.ratings.map((r) => ({
                  code: r.jobSlug,
                  libelle: r.jobSlug,
                  codeGrandDomaine: 'M',
                })),
              );
            }
            return Promise.resolve(candidates);
          }),
        },
        refinedBatch: { create: vi.fn().mockResolvedValue({}) },
      } as any;
    }

    function build(prisma: any) {
      return new QuestionnaireService(
        prisma,
        jobsMock as any,
        aiMock as any,
        matchingMock as any,
      );
    }

    it('refuse si la session nest pas payee', async () => {
      // Neutralise DEV_BYPASS_PAYMENT (=true dans le .env de dev) pour tester
      // réellement le garde-paiement.
      vi.stubEnv('DEV_BYPASS_PAYMENT', 'false');
      const session = makeSession({ isPaid: false, ratings: [
        { jobSlug: 'M1', rating: 'like' },
        { jobSlug: 'M2', rating: 'like' },
        { jobSlug: 'M3', rating: 'like' },
      ] });
      const svc = build(makePrisma(session, []));

      await expect(svc.generateNextBatch('sess-1')).rejects.toThrow(
        BadRequestException,
      );
      vi.unstubAllEnvs();
    });

    it('refuse sil ny a pas assez de nouvelles notes', async () => {
      const session = makeSession({
        ratings: [
          { jobSlug: 'M1', rating: 'like' },
          { jobSlug: 'M2', rating: 'dislike' },
        ], // 2 < MIN_NEW_RATINGS (3)
      });
      const svc = build(makePrisma(session, []));

      await expect(svc.generateNextBatch('sess-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('retourne hasMore=false sans appel IA quand le plafond est atteint', async () => {
      const refinedBatches = Array.from({ length: 5 }, (_, i) => ({
        batchNumber: i + 2,
        ratingsAtCreation: 0,
        matches: [],
      }));
      const session = makeSession({
        refinedBatches,
        ratings: [
          { jobSlug: 'M1', rating: 'like' },
          { jobSlug: 'M2', rating: 'like' },
          { jobSlug: 'M3', rating: 'like' },
        ],
      });
      const svc = build(makePrisma(session, []));

      const res = await svc.generateNextBatch('sess-1');

      expect(res.hasMore).toBe(false);
      expect(res.matches).toEqual([]);
      expect(aiMock.rankJobsWithPreferences).not.toHaveBeenCalled();
    });

    it('genere un batch, exclut les metiers deja vus et persiste le cache', async () => {
      const session = makeSession({
        isPaid: true,
        matches: [{ jobSlug: 'P1' }], // passe 1
        refinedBatches: [
          {
            batchNumber: 2,
            ratingsAtCreation: 3,
            matches: [{ job: { slug: 'B1' } }], // batch precedent
          },
        ],
        ratings: [
          { jobSlug: 'P1', rating: 'like' },
          { jobSlug: 'M2', rating: 'like' },
          { jobSlug: 'M3', rating: 'dislike', reason: 'trop physique' },
          { jobSlug: 'M4', rating: 'like' },
          { jobSlug: 'M5', rating: 'like' },
          { jobSlug: 'M6', rating: 'like' },
        ], // 6 notes, baseline 3 → 3 nouvelles ≥ MIN
      });
      const candidates = Array.from({ length: 8 }, (_, i) => ({
        code: `C${i + 1}`,
        libelle: `Metier ${i + 1}`,
      }));
      const prisma = makePrisma(session, candidates);
      const svc = build(prisma);

      aiMock.rankJobsWithPreferences.mockResolvedValueOnce({
        scores: Object.fromEntries(candidates.map((c, i) => [c.code, 90 - i])),
        insight: 'Tu aimes le concret.',
      });
      aiMock.generateRationales.mockResolvedValueOnce(
        Object.fromEntries(candidates.map((c) => [c.code, `Parce que ${c.code}`])),
      );
      jobsMock.findBySlug.mockImplementation((slug: string) =>
        Promise.resolve({ slug, title: slug, tagline: '' }),
      );

      const res = await svc.generateNextBatch('sess-1');

      // Le batch suit le dernier (2) → 3, plafond pas atteint → hasMore.
      expect(res.batchNumber).toBe(3);
      expect(res.hasMore).toBe(true);
      expect(res.insight).toBe('Tu aimes le concret.');
      expect(res.matches).toHaveLength(5); // REFINED_BATCH_SIZE
      expect(res.matches[0].rationale).toBe('Parce que C1');

      // Exclusion cumulée : la requête candidats exclut P1 (passe 1) et B1 (batch 2).
      const candidateCall = prisma.romeJob.findMany.mock.calls.find(
        (c: any[]) => !c[0]?.select?.codeGrandDomaine,
      );
      const notIn = candidateCall[0].where.code.notIn as string[];
      expect(notIn).toContain('P1');
      expect(notIn).toContain('B1');

      // Persistance : batchNumber 3 + snapshot du nombre de notes (6).
      expect(prisma.refinedBatch.create).toHaveBeenCalledOnce();
      const created = prisma.refinedBatch.create.mock.calls[0][0].data;
      expect(created.batchNumber).toBe(3);
      expect(created.ratingsAtCreation).toBe(6);
    });
  });
});
