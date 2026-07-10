import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  health() {
    return { status: 'ok' };
  }

  /**
   * ⚠️ TEMPORAIRE — vérifie que Sentry capte bien les exceptions.
   * Lève une erreur non gérée → doit apparaître dans le dashboard Sentry.
   * À SUPPRIMER une fois la chaîne validée.
   */
  @Get('debug-sentry')
  debugSentry() {
    throw new Error('Sentry test error — endpoint /v1/debug-sentry');
  }
}
