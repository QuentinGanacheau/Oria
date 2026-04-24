import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnthropicProvider } from './anthropic.provider';
import { GeminiProvider } from './gemini.provider';
import { OpenAiProvider } from './openai.provider';
import type { AiProvider } from './ai-provider.interface';

/**
 * Modèles par défaut par provider — pensés pour rester bon marché tout en
 * gardant une qualité correcte pour de l'extraction de signaux courts.
 * Surchargeables via la variable d'env AI_MODEL.
 */
const DEFAULT_MODELS: Record<string, string> = {
  gemini: 'gemini-2.0-flash',
  openai: 'gpt-4.1-mini',
  anthropic: 'claude-haiku-4-5',
};

type SupportedProvider = 'gemini' | 'openai' | 'anthropic';

function isSupportedProvider(value: string): value is SupportedProvider {
  return value === 'gemini' || value === 'openai' || value === 'anthropic';
}

/**
 * Instancie le provider d'IA configuré ou retourne null si :
 *  - AI_PROVIDER est absent / inconnu,
 *  - la clé API correspondante n'est pas définie.
 *
 * null est une valeur légitime : l'app fonctionne alors en mode "règles pures"
 * (fallback documenté dans AiService). Aucun throw au démarrage : on veut que
 * l'environnement de dev tourne même sans clé.
 */
export function createAiProvider(
  config: ConfigService,
  logger: Logger,
): AiProvider | null {
  const raw = config.get<string>('AI_PROVIDER')?.toLowerCase().trim();

  if (!raw) {
    logger.log('AI_PROVIDER non défini — IA désactivée (mode règles).');
    return null;
  }

  if (!isSupportedProvider(raw)) {
    logger.warn(
      `AI_PROVIDER="${raw}" non supporté. Valeurs acceptées : gemini | openai | anthropic.`,
    );
    return null;
  }

  const model = config.get<string>('AI_MODEL')?.trim() || DEFAULT_MODELS[raw];

  switch (raw) {
    case 'gemini': {
      const key = config.get<string>('GEMINI_API_KEY');
      if (!key) {
        logger.warn('AI_PROVIDER=gemini mais GEMINI_API_KEY absente.');
        return null;
      }
      return new GeminiProvider(key, model);
    }
    case 'openai': {
      const key = config.get<string>('OPENAI_API_KEY');
      if (!key) {
        logger.warn('AI_PROVIDER=openai mais OPENAI_API_KEY absente.');
        return null;
      }
      return new OpenAiProvider(key, model);
    }
    case 'anthropic': {
      const key = config.get<string>('ANTHROPIC_API_KEY');
      if (!key) {
        logger.warn('AI_PROVIDER=anthropic mais ANTHROPIC_API_KEY absente.');
        return null;
      }
      return new AnthropicProvider(key, model);
    }
  }
}
