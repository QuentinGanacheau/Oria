import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnthropicProvider } from './anthropic.provider';
import { ChainProvider } from './chain.provider';
import { GeminiProvider } from './gemini.provider';
import { OpenAiProvider } from './openai.provider';
import type { AiProvider } from './ai-provider.interface';

/**
 * Modèles par défaut par provider — bon marché + qualité correcte pour de
 * l'extraction de signaux courts et du reranking.
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
 * Construit un provider IA à partir de la configuration.
 *
 * Priorité de configuration :
 *   1. AI_PROVIDERS (liste ordonnée, ex: "gemini,openai,anthropic")
 *      → construit un ChainProvider qui tente chaque provider dans l'ordre.
 *   2. AI_PROVIDER (provider unique, rétrocompatibilité)
 *      → instancie directement le provider nommé.
 *
 * Un provider n'est ajouté à la chaîne que si sa clé API est présente.
 * Si aucun provider n'est disponible, retourne null → l'app fonctionne
 * en mode dégradé (résultats sans IA, pas de crash au démarrage).
 *
 * Exemple .env pour la redondance maximale :
 *   AI_PROVIDERS=gemini,openai,anthropic
 *   GEMINI_API_KEY=...
 *   OPENAI_API_KEY=...
 *   ANTHROPIC_API_KEY=...
 */
export function createAiProvider(
  config: ConfigService,
  logger: Logger,
): AiProvider | null {
  const model = config.get<string>('AI_MODEL')?.trim();

  // ── Lecture de la liste de providers ─────────────────────────────────
  const rawChain = config.get<string>('AI_PROVIDERS')?.toLowerCase().trim();
  const rawSingle = config.get<string>('AI_PROVIDER')?.toLowerCase().trim();

  const rawList: string[] = rawChain
    ? rawChain.split(',').map((s) => s.trim()).filter(Boolean)
    : rawSingle
      ? [rawSingle]
      : [];

  if (rawList.length === 0) {
    logger.log('AI_PROVIDER(S) non défini — IA désactivée (mode règles).');
    return null;
  }

  // ── Construction des providers disponibles ───────────────────────────
  const providers: AiProvider[] = [];

  for (const raw of rawList) {
    if (!isSupportedProvider(raw)) {
      logger.warn(
        `Provider inconnu "${raw}" ignoré. Valeurs acceptées : gemini | openai | anthropic.`,
      );
      continue;
    }

    const resolvedModel = model ?? DEFAULT_MODELS[raw];
    const provider = buildSingleProvider(raw, resolvedModel, config, logger);
    if (provider) {
      providers.push(provider);
    }
  }

  if (providers.length === 0) {
    logger.warn('Aucun provider IA configuré avec une clé valide — IA désactivée.');
    return null;
  }

  if (providers.length === 1) {
    logger.log(`IA activée via provider "${providers[0].name}".`);
    return providers[0];
  }

  const chain = new ChainProvider(providers, logger);
  logger.log(`IA activée en mode chaîne : ${chain.name}.`);
  return chain;
}

function buildSingleProvider(
  name: SupportedProvider,
  model: string,
  config: ConfigService,
  logger: Logger,
): AiProvider | null {
  switch (name) {
    case 'gemini': {
      const key = config.get<string>('GEMINI_API_KEY');
      if (!key) {
        logger.warn('gemini ignoré : GEMINI_API_KEY absente.');
        return null;
      }
      return new GeminiProvider(key, model);
    }
    case 'openai': {
      const key = config.get<string>('OPENAI_API_KEY');
      if (!key) {
        logger.warn('openai ignoré : OPENAI_API_KEY absente.');
        return null;
      }
      return new OpenAiProvider(key, model);
    }
    case 'anthropic': {
      const key = config.get<string>('ANTHROPIC_API_KEY');
      if (!key) {
        logger.warn('anthropic ignoré : ANTHROPIC_API_KEY absente.');
        return null;
      }
      return new AnthropicProvider(key, model);
    }
  }
}
