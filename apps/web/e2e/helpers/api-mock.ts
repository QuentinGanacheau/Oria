import type { Page } from '@playwright/test';

const API = 'http://localhost:4000/v1';

export const SESSION_ID = 'pw-test-session';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const SITUATION_QUESTION = {
  id: 'situation',
  text: 'Quelle est ta situation actuelle ?',
  type: 'SINGLE_CHOICE',
  options: [
    { id: 'lycee', label: 'Lycéen(ne)' },
    { id: 'etudes_longues', label: 'Étudiant(e) (Bac+2 et plus)' },
    { id: 'actif', label: 'Actif(ve) / En poste' },
    { id: 'reconversion', label: 'En reconversion' },
  ],
};

const CADRE_QUESTION = {
  id: 'cadre_travail',
  text: 'Quel cadre de travail te convient le mieux ?',
  type: 'SINGLE_CHOICE',
  options: [
    { id: 'bureau_ecran', label: 'Bureau / Écran' },
    { id: 'terrain', label: 'Terrain / Déplacements' },
    { id: 'mixte', label: 'Mixte' },
  ],
};

export const MOCK_MATCHES = [
  {
    job: {
      slug: 'M1805',
      title: 'Développeur informatique',
      tagline: 'Construis les outils de demain',
      summary: 'Conçoit et développe des applications logicielles.',
      missions: ['Analyser les besoins', 'Coder des fonctionnalités'],
      skills: ['JavaScript', 'Python'],
      formations: ['Bac+3 informatique'],
      salaryRangeHint: '35 000 – 55 000 €',
      workContext: 'Bureau',
    },
    score: 85,
    scorePercent: 85,
    rationale: 'Ton profil analytique correspond bien à ce métier.',
  },
  {
    job: {
      slug: 'M1802',
      title: 'Expert systèmes d\'information',
      tagline: 'Pilote les infrastructures SI',
      summary: 'Assure le bon fonctionnement des systèmes informatiques.',
      missions: ['Auditer les systèmes', 'Optimiser les performances'],
      skills: ['Réseaux', 'Linux'],
      formations: ['Bac+5 informatique'],
      salaryRangeHint: '45 000 – 65 000 €',
      workContext: 'Bureau',
    },
    score: 72,
    scorePercent: 72,
    rationale: 'Ta rigueur est un atout pour ce rôle.',
  },
];

// portrait: null → PortraitScreen appelle onComplete() immédiatement → pas d'animation à attendre
export const MOCK_PORTRAIT = null;

// ─── Helpers de mock ─────────────────────────────────────────────────────────

export async function mockStart(page: Page) {
  await page.route(`${API}/questionnaire/start`, (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        sessionId: SESSION_ID,
        complete: false,
        question: SITUATION_QUESTION,
        progress: { answered: 0, total: null },
      }),
    }),
  );
}

/**
 * Mock /next avec un parcours minimal :
 *   réponse 1 (situation) → cadre_travail
 *   réponse 2 (cadre_travail) → complete: true
 */
export async function mockNext(page: Page) {
  let call = 0;
  await page.route(`${API}/questionnaire/next`, (route) => {
    call++;
    if (call === 1) {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          complete: false,
          question: CADRE_QUESTION,
          progress: { answered: 1, total: 10 },
        }),
      });
    }
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        complete: true,
        question: null,
        progress: { answered: 2, total: 10 },
      }),
    });
  });
}

export async function mockMatch(page: Page) {
  await page.route(`${API}/questionnaire/match`, (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        sessionId: SESSION_ID,
        matches: MOCK_MATCHES,
        portrait: MOCK_PORTRAIT,
      }),
    }),
  );
}

export async function mockEmailCapture(page: Page) {
  await page.route(`${API}/email/capture`, (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, emailSent: true }),
    }),
  );
}

/** Monte tous les mocks API nécessaires au flow questionnaire complet. */
export async function mockAllApi(page: Page) {
  await mockStart(page);
  await mockNext(page);
  await mockMatch(page);
  await mockEmailCapture(page);
}
