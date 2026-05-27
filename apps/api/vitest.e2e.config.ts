import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts'],
    // Les tests E2E démarrent NestJS + SQLite → timeout généreux
    testTimeout: 30_000,
    hookTimeout: 120_000,
    // Séquentiel obligatoire : une seule DB de test partagée
    fileParallelism: false,
    env: {
      // Neutralise le bypass paiement pour que les guards soient testables
      DEV_BYPASS_PAYMENT: 'false',
    },
  },
});
