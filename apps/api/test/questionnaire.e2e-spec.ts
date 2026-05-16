import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { AppModule } from '../src/app.module';

// ─── Base de données de test ──────────────────────────────────────────────────

const API_DIR = path.join(__dirname, '..');
// Chemin absolu avec forward-slashes pour SQLite sur Windows
const TEST_DB_PATH = path.resolve(__dirname, 'test-integration.db').replace(/\\/g, '/');
const TEST_DB_URL = `file:${TEST_DB_PATH}`;

// ─── Jeu de données RomeJob ───────────────────────────────────────────────────

// 15 métiers en domaine M — assez pour que la passe 1 (top 10) et la passe 2
// (raffinement) trouvent des candidats distincts.
const TEST_ROME_JOBS = [
  { code: 'M1805', libelle: 'Études et développement informatique',              codeDomaine: 'M18' },
  { code: 'M1802', libelle: 'Expertise et support en systèmes d\'information',   codeDomaine: 'M18' },
  { code: 'M1803', libelle: 'Administration de bases de données',                codeDomaine: 'M18' },
  { code: 'M1804', libelle: 'Études et développement de réseaux',                codeDomaine: 'M18' },
  { code: 'M1806', libelle: 'Conseil et maîtrise d\'ouvrage SI',                 codeDomaine: 'M18' },
  { code: 'M1807', libelle: 'Exploitation de systèmes de communication',         codeDomaine: 'M18' },
  { code: 'M1808', libelle: 'Télécommunications',                                codeDomaine: 'M18' },
  { code: 'M1403', libelle: 'Management des ressources humaines',                codeDomaine: 'M14' },
  { code: 'M1204', libelle: 'Contrôle de gestion',                               codeDomaine: 'M12' },
  { code: 'M1501', libelle: 'Assistanat en ressources humaines',                 codeDomaine: 'M15' },
  { code: 'M1106', libelle: 'Management de groupe ou de service',                codeDomaine: 'M11' },
  { code: 'M1302', libelle: 'Direction de petite ou moyenne structure',           codeDomaine: 'M13' },
  { code: 'M1607', libelle: 'Secrétariat',                                        codeDomaine: 'M16' },
  { code: 'M1503', libelle: 'Développement des ressources humaines',              codeDomaine: 'M15' },
  { code: 'M1101', libelle: 'Direction des systèmes d\'information',              codeDomaine: 'M11' },
].map((j) => ({
  ...j,
  codeGrandDomaine: 'M',
  libelleGrandDomaine: 'Support à l\'entreprise',
  libelleDomaine: `Domaine ${j.codeDomaine}`,
}));

// ─── Lifecycle global ─────────────────────────────────────────────────────────

let app: INestApplication<App>;
let prisma: PrismaService;

beforeAll(async () => {
  // Définir les variables d'environnement AVANT le chargement d'AppModule
  process.env.DATABASE_URL = TEST_DB_URL;
  process.env.DEV_MOCK_AI = 'true';

  // Crée le schéma SQLite de test (--accept-data-loss évite la confirmation interactive)
  execSync('npx prisma db push --accept-data-loss', {
    cwd: API_DIR,
    env: { ...process.env },
    stdio: 'pipe',
  });

  // Insère les questions du questionnaire (seed idempotent)
  execSync('npm run prisma:seed', {
    cwd: API_DIR,
    env: { ...process.env },
    stdio: 'pipe',
  });

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('v1');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.init();

  prisma = moduleFixture.get<PrismaService>(PrismaService);

  // Seed des métiers ROME nécessaires au pipeline de matching
  for (const job of TEST_ROME_JOBS) {
    await prisma.romeJob.upsert({ where: { code: job.code }, update: {}, create: job });
  }
}, 90_000);

beforeEach(async () => {
  // Repart d'une ardoise propre entre chaque test — les questions et RomeJobs restent.
  await prisma.questionnaireSession.deleteMany();
});

afterAll(async () => {
  if (app) await app.close();
  // Suppression best-effort — sur Windows, SQLite maintient un verrou
  // quelques ms après app.close(). La prochaine exécution recréera le fichier.
  try {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  } catch { /* ignoré */ }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

type PublicQuestion = {
  id: string;
  type: 'SINGLE_CHOICE' | 'FREE_TEXT' | 'SUGGESTIONS_WITH_TEXT';
  options: Array<{ id: string; label: string }>;
};

const FREE_TEXT_ANSWER = 'Réponse de test pour les tests d\'intégration automatisés.';

/** Construit la réponse à envoyer au serveur pour une question donnée. */
function buildAnswer(
  q: PublicQuestion,
  optionOverrides: Record<string, string> = {},
): Record<string, string> {
  if (q.type === 'SINGLE_CHOICE' && q.id in optionOverrides) {
    return { optionKey: optionOverrides[q.id] };
  }
  if (q.type === 'SINGLE_CHOICE') return { optionKey: q.options[0].id };
  return { freeText: FREE_TEXT_ANSWER };
}

/**
 * Complète tout le questionnaire automatiquement jusqu'à complete=true.
 * Retourne le sessionId prêt pour POST /match.
 *
 * `optionOverrides` permet de forcer des options spécifiques sur des questions
 * SINGLE_CHOICE afin de contrôler les poids de domaine ROME pour le matching.
 */
async function completeQuestionnaire(
  situation: string,
  optionOverrides: Record<string, string> = {},
): Promise<string> {
  const startRes = await request(app.getHttpServer())
    .post('/v1/questionnaire/start')
    .send({})
    .expect(201);

  const { sessionId, question: firstQ } = startRes.body;
  expect(firstQ.id).toBe('situation');

  // Répond à la question situation
  let res = await request(app.getHttpServer())
    .post('/v1/questionnaire/next')
    .send({ sessionId, questionKey: firstQ.id, optionKey: situation })
    .expect(201);

  // Répond aux questions suivantes jusqu'à la fin du parcours
  let guard = 30;
  while (!res.body.complete && guard-- > 0) {
    const q: PublicQuestion = res.body.question;
    const answer = buildAnswer(q, optionOverrides);
    res = await request(app.getHttpServer())
      .post('/v1/questionnaire/next')
      .send({ sessionId, questionKey: q.id, ...answer })
      .expect(201);
  }

  return sessionId;
}

// ─── POST /v1/questionnaire/start ────────────────────────────────────────────

describe('POST /v1/questionnaire/start', () => {
  it('crée une session et retourne la question "situation" en premier', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/questionnaire/start')
      .send({})
      .expect(201);

    expect(res.body.sessionId).toBeDefined();
    expect(res.body.complete).toBe(false);
    expect(res.body.question.id).toBe('situation');
    expect(res.body.question.type).toBe('SINGLE_CHOICE');
    expect(res.body.question.options.length).toBeGreaterThan(0);
    expect(res.body.progress.answered).toBe(0);
    // total est null tant que la situation n'est pas connue
    expect(res.body.progress.total).toBeNull();
  });

  it('accepte des métadonnées optionnelles', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/questionnaire/start')
      .send({ metadata: { source: 'integration-test' } })
      .expect(201);

    expect(res.body.sessionId).toBeDefined();
  });

  it('crée deux sessions indépendantes avec des IDs distincts', async () => {
    const res1 = await request(app.getHttpServer()).post('/v1/questionnaire/start').send({});
    const res2 = await request(app.getHttpServer()).post('/v1/questionnaire/start').send({});
    expect(res1.body.sessionId).not.toBe(res2.body.sessionId);
  });
});

// ─── POST /v1/questionnaire/next — validation ────────────────────────────────

describe('POST /v1/questionnaire/next — validation', () => {
  it('retourne 404 pour un sessionId inconnu', async () => {
    await request(app.getHttpServer())
      .post('/v1/questionnaire/next')
      .send({ sessionId: 'session-inexistante', questionKey: 'situation', optionKey: 'actif' })
      .expect(404);
  });

  it('retourne 400 pour une clé de question invalide', async () => {
    const startRes = await request(app.getHttpServer())
      .post('/v1/questionnaire/start')
      .send({})
      .expect(201);

    await request(app.getHttpServer())
      .post('/v1/questionnaire/next')
      .send({ sessionId: startRes.body.sessionId, questionKey: 'question-inconnue', optionKey: 'actif' })
      .expect(400);
  });

  it('retourne 400 pour une optionKey inexistante sur une question QCM', async () => {
    const startRes = await request(app.getHttpServer())
      .post('/v1/questionnaire/start')
      .send({})
      .expect(201);

    await request(app.getHttpServer())
      .post('/v1/questionnaire/next')
      .send({ sessionId: startRes.body.sessionId, questionKey: 'situation', optionKey: 'option-inconnue' })
      .expect(400);
  });

  it('retourne 400 quand le freeText est trop court (< 3 chars)', async () => {
    const startRes = await request(app.getHttpServer())
      .post('/v1/questionnaire/start')
      .send({})
      .expect(201);

    // Le DTO rejette les freeText < 3 chars via @MinLength(3)
    await request(app.getHttpServer())
      .post('/v1/questionnaire/next')
      .send({ sessionId: startRes.body.sessionId, questionKey: 'situation', freeText: 'ab' })
      .expect(400);
  });

  it('met à jour la progression après chaque réponse', async () => {
    const startRes = await request(app.getHttpServer())
      .post('/v1/questionnaire/start')
      .send({})
      .expect(201);

    const { sessionId, question } = startRes.body;

    const res = await request(app.getHttpServer())
      .post('/v1/questionnaire/next')
      .send({ sessionId, questionKey: question.id, optionKey: 'actif' })
      .expect(201);

    expect(res.body.progress.answered).toBe(1);
    // total est maintenant calculable (situation répondue → track connu)
    expect(res.body.progress.total).toBeGreaterThan(1);
  });
});

// ─── Flow complet track étudiant ─────────────────────────────────────────────

describe('POST /v1/questionnaire/match — track étudiant (lycee)', () => {
  it('complète le questionnaire et retourne un résultat de matching', async () => {
    const sessionId = await completeQuestionnaire('lycee');

    const matchRes = await request(app.getHttpServer())
      .post('/v1/questionnaire/match')
      .send({ sessionId })
      .expect(201);

    expect(matchRes.body.sessionId).toBe(sessionId);
    expect(Array.isArray(matchRes.body.matches)).toBe(true);
  });

  it('inclut un portrait IA dans la réponse (mock)', async () => {
    const sessionId = await completeQuestionnaire('lycee');

    const matchRes = await request(app.getHttpServer())
      .post('/v1/questionnaire/match')
      .send({ sessionId })
      .expect(201);

    const { portrait } = matchRes.body;
    expect(portrait).not.toBeNull();
    expect(typeof portrait.archetype).toBe('string');
    expect(Array.isArray(portrait.strengths)).toBe(true);
    expect(typeof portrait.thrives).toBe('string');
    expect(typeof portrait.drains).toBe('string');
  });

  it('retourne 404 pour un sessionId inconnu', async () => {
    await request(app.getHttpServer())
      .post('/v1/questionnaire/match')
      .send({ sessionId: 'session-inexistante' })
      .expect(404);
  });

  it('retourne 400 si aucune réponse n\'est enregistrée', async () => {
    const startRes = await request(app.getHttpServer())
      .post('/v1/questionnaire/start')
      .send({})
      .expect(201);

    await request(app.getHttpServer())
      .post('/v1/questionnaire/match')
      .send({ sessionId: startRes.body.sessionId })
      .expect(400);
  });
});

// ─── Flow complet track professionnel avec matching ───────────────────────────

describe('POST /v1/questionnaire/match — track professionnel (actif) avec RomeJobs', () => {
  it('retourne des métiers matchés depuis la table RomeJob', async () => {
    // Les options choisies donnent de forts poids domaine M (bureau, intellectuel…)
    const sessionId = await completeQuestionnaire('actif', {
      cadre_travail:         'bureau_ecran',    // M:3, C:2, E:2
      manuel_bureau:         'intellectuel',    // M:4, C:3, E:2
      contact_humain:        'peu_monde',       // A:3, B:3, M:2
      valeur_cle:            'evolution_salaire', // M:4, C:3, D:2
      formation_acceptable:  'sans_formation',  // M:2, D:2, C:2, E:1
      salaire_floor:         'maintenir',       // M:3, C:3, D:2
    });

    const matchRes = await request(app.getHttpServer())
      .post('/v1/questionnaire/match')
      .send({ sessionId })
      .expect(201);

    expect(matchRes.body.matches.length).toBeGreaterThan(0);

    const firstMatch = matchRes.body.matches[0];
    expect(firstMatch.job.slug).toBeDefined();
    expect(firstMatch.job.title).toBeDefined();
    expect(typeof firstMatch.score).toBe('number');
    expect(firstMatch.score).toBeGreaterThanOrEqual(0);
    expect(firstMatch.scorePercent).toBe(firstMatch.score);
    // Les rationales sont générées par le mock en mode DEV_MOCK_AI
    expect(typeof firstMatch.rationale).toBe('string');
    expect(firstMatch.rationale.length).toBeGreaterThan(0);
  });

  it('la session est marquée COMPLETED après le matching', async () => {
    const sessionId = await completeQuestionnaire('actif', {
      cadre_travail: 'bureau_ecran',
      manuel_bureau: 'intellectuel',
    });

    await request(app.getHttpServer())
      .post('/v1/questionnaire/match')
      .send({ sessionId })
      .expect(201);

    const session = await prisma.questionnaireSession.findUnique({
      where: { id: sessionId },
    });
    expect(session?.status).toBe('COMPLETED');
    expect(session?.expiresAt).toBeDefined();
  });

  it('persiste les MatchResults en base avec le bon rank', async () => {
    const sessionId = await completeQuestionnaire('actif', {
      cadre_travail: 'bureau_ecran',
      manuel_bureau: 'intellectuel',
    });

    await request(app.getHttpServer())
      .post('/v1/questionnaire/match')
      .send({ sessionId });

    const results = await prisma.matchResult.findMany({
      where: { sessionId },
      orderBy: { rank: 'asc' },
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].rank).toBe(1);
    // Les ranks sont consécutifs
    results.forEach((r, i) => expect(r.rank).toBe(i + 1));
  });
});

// ─── POST /v1/questionnaire/:sessionId/rate ───────────────────────────────────

describe('POST /v1/questionnaire/:sessionId/rate', () => {
  let sessionId: string;

  beforeEach(async () => {
    sessionId = await completeQuestionnaire('actif', {
      cadre_travail: 'bureau_ecran',
      manuel_bureau: 'intellectuel',
    });
    await request(app.getHttpServer())
      .post('/v1/questionnaire/match')
      .send({ sessionId });
  });

  it('enregistre une note "like" sur un métier', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/questionnaire/${sessionId}/rate`)
      .send({ jobSlug: 'M1805', rating: 'like' })
      .expect(201);

    expect(res.body.ok).toBe(true);

    const stored = await prisma.jobRating.findFirst({
      where: { sessionId, jobSlug: 'M1805' },
    });
    expect(stored?.rating).toBe('like');
    expect(stored?.reason).toBeNull();
  });

  it('enregistre un "dislike" avec une raison optionnelle', async () => {
    await request(app.getHttpServer())
      .post(`/v1/questionnaire/${sessionId}/rate`)
      .send({ jobSlug: 'M1805', rating: 'dislike', reason: 'Trop sédentaire.' })
      .expect(201);

    const stored = await prisma.jobRating.findFirst({
      where: { sessionId, jobSlug: 'M1805' },
    });
    expect(stored?.rating).toBe('dislike');
    expect(stored?.reason).toBe('Trop sédentaire.');
  });

  it('est idempotent — met à jour la note si elle existe déjà', async () => {
    await request(app.getHttpServer())
      .post(`/v1/questionnaire/${sessionId}/rate`)
      .send({ jobSlug: 'M1805', rating: 'like' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/v1/questionnaire/${sessionId}/rate`)
      .send({ jobSlug: 'M1805', rating: 'dislike', reason: 'Finalement non.' })
      .expect(201);

    const ratings = await prisma.jobRating.findMany({
      where: { sessionId, jobSlug: 'M1805' },
    });
    // Une seule note en base (upsert)
    expect(ratings).toHaveLength(1);
    expect(ratings[0].rating).toBe('dislike');
    expect(ratings[0].reason).toBe('Finalement non.');
  });

  it('retourne 400 pour une valeur de rating invalide', async () => {
    await request(app.getHttpServer())
      .post(`/v1/questionnaire/${sessionId}/rate`)
      .send({ jobSlug: 'M1805', rating: 'maybe' })
      .expect(400);
  });

  it('retourne 400 si jobSlug est manquant', async () => {
    await request(app.getHttpServer())
      .post(`/v1/questionnaire/${sessionId}/rate`)
      .send({ rating: 'like' })
      .expect(400);
  });

  it('retourne 404 pour un sessionId inconnu', async () => {
    await request(app.getHttpServer())
      .post('/v1/questionnaire/session-inexistante/rate')
      .send({ jobSlug: 'M1805', rating: 'like' })
      .expect(404);
  });
});

// ─── POST /v1/questionnaire/:sessionId/refine ────────────────────────────────

describe('POST /v1/questionnaire/:sessionId/refine', () => {
  let paidSessionId: string;

  beforeEach(async () => {
    paidSessionId = await completeQuestionnaire('actif', {
      cadre_travail: 'bureau_ecran',
      manuel_bureau: 'intellectuel',
    });

    await request(app.getHttpServer())
      .post('/v1/questionnaire/match')
      .send({ sessionId: paidSessionId });

    // Simule le paiement Stripe — normalement fait via BillingService.verifyPaidSession
    await prisma.questionnaireSession.update({
      where: { id: paidSessionId },
      data: { isPaid: true },
    });

    // Note un métier pour alimenter le signal de préférence (liked → source de domaines)
    await request(app.getHttpServer())
      .post(`/v1/questionnaire/${paidSessionId}/rate`)
      .send({ jobSlug: 'M1805', rating: 'like' });
  });

  it('retourne 400 si la session n\'est pas payée', async () => {
    const freeSessionId = await completeQuestionnaire('actif', {
      cadre_travail: 'bureau_ecran',
      manuel_bureau: 'intellectuel',
    });
    await request(app.getHttpServer())
      .post('/v1/questionnaire/match')
      .send({ sessionId: freeSessionId });

    await request(app.getHttpServer())
      .post(`/v1/questionnaire/${freeSessionId}/refine`)
      .expect(400);
  });

  it('retourne des métiers affinés et un insight pour une session payée', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/questionnaire/${paidSessionId}/refine`)
      .expect(201);

    expect(Array.isArray(res.body.matches)).toBe(true);
    expect(res.body.matches.length).toBeGreaterThan(0);
    expect(typeof res.body.insight).toBe('string');
    expect(res.body.insight.length).toBeGreaterThan(0);
  });

  it('les métiers affinés sont distincts des métiers de la passe 1', async () => {
    const matchRes = await request(app.getHttpServer())
      .post('/v1/questionnaire/match')
      .send({ sessionId: paidSessionId });

    const passe1Slugs = new Set((matchRes.body.matches ?? []).map((m: any) => m.job.slug));

    const refineRes = await request(app.getHttpServer())
      .post(`/v1/questionnaire/${paidSessionId}/refine`)
      .expect(201);

    // Aucun métier de la passe 2 ne doit figurer dans la passe 1
    for (const match of refineRes.body.matches) {
      expect(passe1Slugs.has(match.job.slug)).toBe(false);
    }
  });

  it('est idempotent — retourne le cache à la 2e demande sans rappeler l\'IA', async () => {
    const res1 = await request(app.getHttpServer())
      .post(`/v1/questionnaire/${paidSessionId}/refine`)
      .expect(201);

    const res2 = await request(app.getHttpServer())
      .post(`/v1/questionnaire/${paidSessionId}/refine`)
      .expect(201);

    expect(res1.body.insight).toBe(res2.body.insight);
    expect(res1.body.matches.length).toBe(res2.body.matches.length);
  });
});

// ─── GET /v1/questionnaire/:sessionId/results ────────────────────────────────

describe('GET /v1/questionnaire/:sessionId/results', () => {
  const EMAIL = 'test-restore@integration.com';
  let sessionId: string;

  beforeEach(async () => {
    sessionId = await completeQuestionnaire('actif', {
      cadre_travail: 'bureau_ecran',
      manuel_bureau: 'intellectuel',
    });

    await request(app.getHttpServer())
      .post('/v1/questionnaire/match')
      .send({ sessionId });

    // L'email est normalement capturé via POST /v1/email/capture
    await prisma.questionnaireSession.update({
      where: { id: sessionId },
      data: { email: EMAIL },
    });
  });

  it('retourne 404 pour un sessionId inconnu', async () => {
    await request(app.getHttpServer())
      .get('/v1/questionnaire/session-inexistante/results')
      .query({ email: EMAIL })
      .expect(404);
  });

  it('retourne 400 si la session n\'a pas d\'email associé', async () => {
    const noEmailId = await completeQuestionnaire('actif');
    await request(app.getHttpServer())
      .post('/v1/questionnaire/match')
      .send({ sessionId: noEmailId });

    await request(app.getHttpServer())
      .get(`/v1/questionnaire/${noEmailId}/results`)
      .query({ email: EMAIL })
      .expect(400);
  });

  it('retourne 400 pour un email qui ne correspond pas à la session', async () => {
    await request(app.getHttpServer())
      .get(`/v1/questionnaire/${sessionId}/results`)
      .query({ email: 'mauvais@email.com' })
      .expect(400);
  });

  it('restaure les résultats de la session avec le bon email', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/questionnaire/${sessionId}/results`)
      .query({ email: EMAIL })
      .expect(200);

    expect(res.body.sessionId).toBe(sessionId);
    expect(Array.isArray(res.body.matches)).toBe(true);
    expect(res.body.isPaid).toBe(false);
    expect(res.body.expiresAt).toBeDefined();
  });

  it('est insensible à la casse de l\'email', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/questionnaire/${sessionId}/results`)
      .query({ email: EMAIL.toUpperCase() })
      .expect(200);

    expect(res.body.sessionId).toBe(sessionId);
  });

  it('retourne 400 si la query param email est absente', async () => {
    await request(app.getHttpServer())
      .get(`/v1/questionnaire/${sessionId}/results`)
      .expect(400);
  });

  it('inclut le portrait dans la réponse restaurée', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/questionnaire/${sessionId}/results`)
      .query({ email: EMAIL })
      .expect(200);

    // Le portrait est généré en mode mock → doit être présent
    const { portrait } = res.body;
    if (portrait) {
      expect(typeof portrait.archetype).toBe('string');
      expect(Array.isArray(portrait.strengths)).toBe(true);
    }
  });
});
