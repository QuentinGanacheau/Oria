import { test, expect } from '@playwright/test';

test.describe('Page d\'accueil', () => {
  test('charge et affiche le titre principal', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/FindYourJob/i);
    // Le titre hero doit être visible
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('contient un CTA vers le questionnaire', async ({ page }) => {
    await page.goto('/');
    // Il doit y avoir au moins un lien pointant vers /questionnaire
    const ctaLink = page.locator('a[href="/questionnaire"]').first();
    await expect(ctaLink).toBeVisible();
  });

  test('naviguer vers le questionnaire depuis le CTA', async ({ page }) => {
    await page.goto('/');
    await page.locator('a[href="/questionnaire"]').first().click();
    await expect(page).toHaveURL('/questionnaire');
  });
});
