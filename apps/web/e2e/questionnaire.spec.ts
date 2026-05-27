import { test, expect } from '@playwright/test';
import {
  mockAllApi,
  mockStart,
  mockNext,
  mockMatch,
  mockEmailCapture,
  SESSION_ID,
} from './helpers/api-mock';

test.describe('Questionnaire — démarrage', () => {
  test('affiche la question "situation" au chargement', async ({ page }) => {
    await mockAllApi(page);
    await page.goto('/questionnaire');

    await expect(page.getByText('Quelle est ta situation actuelle ?')).toBeVisible();
    // Les options sont affichées
    await expect(page.getByRole('button', { name: 'Lycéen(ne)' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Actif/i })).toBeVisible();
  });

  test('la barre de progression est absente avant de connaître la situation', async ({ page }) => {
    await mockAllApi(page);
    await page.goto('/questionnaire');

    await expect(page.getByText('Quelle est ta situation actuelle ?')).toBeVisible();
    // Le % de progression ne s'affiche pas tant que total est null
    await expect(page.getByText(/% complété/)).not.toBeVisible();
  });
});

test.describe('Questionnaire — réponse QCM', () => {
  test('répond à la situation et passe à la question suivante', async ({ page }) => {
    await mockAllApi(page);
    await page.goto('/questionnaire');

    await expect(page.getByText('Quelle est ta situation actuelle ?')).toBeVisible();
    await page.getByRole('button', { name: /Actif/i }).click();

    // La deuxième question s'affiche
    await expect(page.getByText('Quel cadre de travail te convient le mieux ?')).toBeVisible();
  });

  test('la progression avance après la première réponse', async ({ page }) => {
    await mockAllApi(page);
    await page.goto('/questionnaire');

    await page.getByRole('button', { name: /Actif/i }).click();

    // total est maintenant connu → la progression s'affiche
    await expect(page.getByText(/% complété/)).toBeVisible();
    // Le compteur de questions est visible
    await expect(page.getByText('2 / 10')).toBeVisible();
  });

  test('le bouton Précédent apparaît dès la 2e question', async ({ page }) => {
    await mockAllApi(page);
    await page.goto('/questionnaire');

    await page.getByRole('button', { name: /Actif/i }).click();
    await expect(page.getByRole('button', { name: /Précédent/i })).toBeVisible();
  });
});

test.describe('Questionnaire — flow complet', () => {
  test('complétion → affiche EmailGate avec le bon nombre de métiers', async ({ page }) => {
    await mockAllApi(page);
    await page.goto('/questionnaire');

    // Répond aux deux questions
    await page.getByRole('button', { name: /Actif/i }).click();
    await page.getByRole('button', { name: 'Bureau / Écran' }).click();

    // EmailGate doit apparaître (portrait est null → PortraitScreen skippé)
    await expect(page.getByText('pistes métiers sont prêtes')).toBeVisible();
  });

  test('skip email → redirige vers /resultats', async ({ page }) => {
    await mockAllApi(page);
    await page.goto('/questionnaire');

    await page.getByRole('button', { name: /Actif/i }).click();
    await page.getByRole('button', { name: 'Bureau / Écran' }).click();

    await expect(page.getByText('pistes métiers sont prêtes')).toBeVisible();

    // Click "Continuer sans email" (skip discret)
    await page.getByRole('button', { name: 'Continuer sans email' }).click();

    // Portrait est null → onPortraitComplete est appelé immédiatement
    // Le router doit rediriger vers /resultats
    await expect(page).toHaveURL('/resultats', { timeout: 5_000 });
  });

  test('soumettre un email → redirige aussi vers /resultats', async ({ page }) => {
    await mockAllApi(page);
    await page.goto('/questionnaire');

    await page.getByRole('button', { name: /Actif/i }).click();
    await page.getByRole('button', { name: 'Bureau / Écran' }).click();

    await expect(page.getByText('pistes métiers sont prêtes')).toBeVisible();

    // Remplit le formulaire
    await page.getByLabel('Ton email').fill('test@exemple.com');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /Voir mes résultats/i }).click();

    await expect(page).toHaveURL('/resultats', { timeout: 5_000 });
  });
});

test.describe('Questionnaire — erreurs réseau', () => {
  test('affiche un message d\'erreur si /start échoue', async ({ page }) => {
    await page.route('http://localhost:4000/v1/questionnaire/start', (route) =>
      route.fulfill({ status: 503, body: 'Service indisponible' }),
    );
    await page.goto('/questionnaire');

    // Le composant affiche le message brut de l'erreur réseau dans un bloc rouge
    await expect(page.locator('.border-red-200')).toBeVisible({ timeout: 5_000 });
  });

  test('affiche le panneau retry si /match échoue (IA indisponible)', async ({ page }) => {
    await mockStart(page);
    await mockNext(page);
    // /match retourne 503
    await page.route('http://localhost:4000/v1/questionnaire/match', (route) =>
      route.fulfill({ status: 503, body: 'Service indisponible' }),
    );

    await page.goto('/questionnaire');
    await page.getByRole('button', { name: /Actif/i }).click();
    await page.getByRole('button', { name: 'Bureau / Écran' }).click();

    // Le bloc d'erreur IA avec le bouton "Réessayer" doit apparaître
    await expect(page.getByText(/momentanément surchargé/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('button', { name: /Réessayer/i })).toBeVisible();
  });

  test('le bouton Réessayer relance /match', async ({ page }) => {
    await mockStart(page);
    await mockNext(page);

    let matchCalls = 0;
    await page.route('http://localhost:4000/v1/questionnaire/match', async (route) => {
      matchCalls++;
      if (matchCalls === 1) {
        return route.fulfill({ status: 503, body: 'Service indisponible' });
      }
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          sessionId: SESSION_ID,
          matches: [
            {
              job: {
                slug: 'M1805',
                title: 'Développeur',
                tagline: '',
                summary: '',
                missions: [],
                skills: [],
                formations: [],
                salaryRangeHint: '',
                workContext: '',
              },
              score: 80,
              scorePercent: 80,
              rationale: 'Ok',
            },
          ],
          portrait: null,
        }),
      });
    });
    await mockEmailCapture(page);

    await page.goto('/questionnaire');
    await page.getByRole('button', { name: /Actif/i }).click();
    await page.getByRole('button', { name: 'Bureau / Écran' }).click();

    await expect(page.getByRole('button', { name: /Réessayer/i })).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: /Réessayer/i }).click();

    // Après le retry réussi, l'EmailGate doit s'afficher
    await expect(page.getByText('pistes métiers sont prêtes')).toBeVisible({ timeout: 5_000 });
  });
});
