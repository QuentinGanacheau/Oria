// Sentry — initialisé AVANT tout autre module (cf. import en tête de main.ts).
//
// Le DSN est lu depuis l'environnement :
//   - présent sur Railway (prod) → Sentry actif
//   - absent en local → no-op, pour ne pas polluer les données de prod avec
//     les erreurs de développement.
import * as Sentry from '@sentry/nestjs';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'production',
  });
}
