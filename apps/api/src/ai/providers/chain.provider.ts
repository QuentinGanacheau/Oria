import { Logger } from '@nestjs/common';
import type { AiCompletionOptions, AiProvider } from './ai-provider.interface';

/**
 * Provider en chaîne : essaie chaque provider dans l'ordre jusqu'au premier succès.
 *
 * Utilisé quand plusieurs clés API sont configurées (ex : Gemini + OpenAI).
 * Si le premier provider retourne une erreur (503, quota, timeout…), le suivant
 * prend le relais de manière transparente pour le reste de l'application.
 *
 * Stratégie d'erreur :
 *   - Toute exception levée par `complete()` déclenche le passage au suivant.
 *   - Si tous échouent, on relève la dernière erreur → l'AiService la catchera
 *     et retournera null (dégradation propre, sans crash).
 */
export class ChainProvider implements AiProvider {
  readonly name: string;

  constructor(
    private readonly providers: AiProvider[],
    private readonly logger: Logger,
  ) {
    this.name = providers.map((p) => p.name).join('>');
  }

  async complete(options: AiCompletionOptions): Promise<string> {
    let lastError: Error | undefined;

    for (const provider of this.providers) {
      try {
        const result = await provider.complete(options);
        // Log seulement si on a dû changer de provider (pas le premier)
        if (provider !== this.providers[0]) {
          this.logger.log(
            `Fallback IA : réponse obtenue via "${provider.name}".`,
          );
        }
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        this.logger.warn(
          `Provider "${provider.name}" en échec — passage au suivant. Erreur : ${lastError.message}`,
        );
      }
    }

    throw lastError ?? new Error('Tous les providers IA ont échoué.');
  }
}
