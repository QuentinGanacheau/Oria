import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Logger } from '@nestjs/common';

// ─── Mocks des providers concrets ────────────────────────────────────────────
// Les classes mock doivent être déclarées AVANT les imports statiques ci-dessous.
// On utilise des classes réelles (pas vi.fn().mockImplementation) car `new Xyz()`
// exige un constructeur valide au sens JS.

vi.mock('./gemini.provider', () => {
  class GeminiProvider {
    name = 'gemini';
    complete = vi.fn();
    constructor(public _key: string, public _model: string) {}
  }
  return { GeminiProvider };
});

vi.mock('./openai.provider', () => {
  class OpenAiProvider {
    name = 'openai';
    complete = vi.fn();
    constructor(public _key: string, public _model: string) {}
  }
  return { OpenAiProvider };
});

vi.mock('./anthropic.provider', () => {
  class AnthropicProvider {
    name = 'anthropic';
    complete = vi.fn();
    constructor(public _key: string, public _model: string) {}
  }
  return { AnthropicProvider };
});

vi.mock('./mistral.provider', () => {
  class MistralProvider {
    name = 'mistral';
    complete = vi.fn();
    constructor(public _key: string, public _model: string) {}
  }
  return { MistralProvider };
});

vi.mock('./chain.provider', () => {
  class ChainProvider {
    name: string;
    complete = vi.fn();
    constructor(public _providers: any[], _logger: any) {
      this.name = _providers.map((p: any) => p.name).join('>');
    }
  }
  return { ChainProvider };
});

// ─── Imports statiques (après les vi.mock) ────────────────────────────────────

import { createAiProvider } from './ai-provider.factory';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildConfig(values: Record<string, string | undefined>) {
  return {
    get: vi.fn((key: string) => values[key]),
  } as any;
}

function buildLogger(): Logger {
  return {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn(),
  } as unknown as Logger;
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('createAiProvider', () => {
  let logger: Logger;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = buildLogger();
  });

  // ─── Aucun provider configuré ─────────────────────────────────────────────

  describe('aucun provider configuré', () => {
    it('retourne null si ni AI_PROVIDERS ni AI_PROVIDER ne sont définis', () => {
      const config = buildConfig({});

      const result = createAiProvider(config, logger);

      expect(result).toBeNull();
    });

    it('logue un message quand l\'IA est désactivée par absence de config', () => {
      const config = buildConfig({});

      createAiProvider(config, logger);

      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('non défini'),
      );
    });

    it('retourne null si AI_PROVIDERS est une chaîne vide', () => {
      const config = buildConfig({ AI_PROVIDERS: '' });

      const result = createAiProvider(config, logger);

      expect(result).toBeNull();
    });
  });

  // ─── Provider unique via AI_PROVIDER ──────────────────────────────────────

  describe('provider unique via AI_PROVIDER', () => {
    it('retourne un GeminiProvider quand AI_PROVIDER=gemini avec clé présente', () => {
      const config = buildConfig({
        AI_PROVIDER: 'gemini',
        GEMINI_API_KEY: 'gk-123',
      });

      const result = createAiProvider(config, logger);

      expect(result).not.toBeNull();
      expect(result?.name).toBe('gemini');
    });

    it('retourne un OpenAiProvider quand AI_PROVIDER=openai avec clé présente', () => {
      const config = buildConfig({
        AI_PROVIDER: 'openai',
        OPENAI_API_KEY: 'sk-123',
      });

      const result = createAiProvider(config, logger);

      expect(result?.name).toBe('openai');
    });

    it('retourne un AnthropicProvider quand AI_PROVIDER=anthropic avec clé présente', () => {
      const config = buildConfig({
        AI_PROVIDER: 'anthropic',
        ANTHROPIC_API_KEY: 'ak-123',
      });

      const result = createAiProvider(config, logger);

      expect(result?.name).toBe('anthropic');
    });

    it('retourne un MistralProvider quand AI_PROVIDER=mistral avec clé présente', () => {
      const config = buildConfig({
        AI_PROVIDER: 'mistral',
        MISTRAL_API_KEY: 'mk-123',
      });

      const result = createAiProvider(config, logger);

      expect(result?.name).toBe('mistral');
    });

    it('retourne null si AI_PROVIDER=mistral mais MISTRAL_API_KEY est absente', () => {
      const config = buildConfig({ AI_PROVIDER: 'mistral' });

      const result = createAiProvider(config, logger);

      expect(result).toBeNull();
    });

    it('retourne null si AI_PROVIDER=gemini mais GEMINI_API_KEY est absente', () => {
      const config = buildConfig({ AI_PROVIDER: 'gemini' });

      const result = createAiProvider(config, logger);

      expect(result).toBeNull();
    });

    it('retourne null si AI_PROVIDER=openai mais OPENAI_API_KEY est absente', () => {
      const config = buildConfig({ AI_PROVIDER: 'openai' });

      const result = createAiProvider(config, logger);

      expect(result).toBeNull();
    });

    it('retourne null si AI_PROVIDER=anthropic mais ANTHROPIC_API_KEY est absente', () => {
      const config = buildConfig({ AI_PROVIDER: 'anthropic' });

      const result = createAiProvider(config, logger);

      expect(result).toBeNull();
    });

    it('logue un warn si la clé API gemini est absente', () => {
      const config = buildConfig({ AI_PROVIDER: 'gemini' });

      createAiProvider(config, logger);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('GEMINI_API_KEY'),
      );
    });

    it('ignore la casse dans AI_PROVIDER (ex: "Gemini" → gemini)', () => {
      const config = buildConfig({
        AI_PROVIDER: 'Gemini',
        GEMINI_API_KEY: 'gk-123',
      });

      const result = createAiProvider(config, logger);

      expect(result?.name).toBe('gemini');
    });

    it('retourne null et logue un warn pour un provider inconnu', () => {
      const config = buildConfig({ AI_PROVIDER: 'cohere' });

      const result = createAiProvider(config, logger);

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('cohere'),
      );
    });
  });

  // ─── Modèle personnalisé ─────────────────────────────────────────────────
  // Les classes mock exposent _key et _model sur l'instance — on les inspecte
  // directement plutôt qu'espionner le constructeur.

  describe('modèle personnalisé via AI_MODEL', () => {
    it('utilise le modèle par défaut "gemini-2.0-flash" si AI_MODEL absent', () => {
      const config = buildConfig({
        AI_PROVIDER: 'gemini',
        GEMINI_API_KEY: 'gk-123',
      });

      const result = createAiProvider(config, logger) as any;

      expect(result._key).toBe('gk-123');
      expect(result._model).toBe('gemini-2.0-flash');
    });

    it('utilise le modèle par défaut "gpt-4.1-mini" pour openai si AI_MODEL absent', () => {
      const config = buildConfig({
        AI_PROVIDER: 'openai',
        OPENAI_API_KEY: 'sk-123',
      });

      const result = createAiProvider(config, logger) as any;

      expect(result._key).toBe('sk-123');
      expect(result._model).toBe('gpt-4.1-mini');
    });

    it('utilise le modèle par défaut "claude-haiku-4-5" pour anthropic si AI_MODEL absent', () => {
      const config = buildConfig({
        AI_PROVIDER: 'anthropic',
        ANTHROPIC_API_KEY: 'ak-123',
      });

      const result = createAiProvider(config, logger) as any;

      expect(result._key).toBe('ak-123');
      expect(result._model).toBe('claude-haiku-4-5');
    });

    it('utilise le modèle par défaut "mistral-small-latest" pour mistral si AI_MODEL absent', () => {
      const config = buildConfig({
        AI_PROVIDER: 'mistral',
        MISTRAL_API_KEY: 'mk-123',
      });

      const result = createAiProvider(config, logger) as any;

      expect(result._key).toBe('mk-123');
      expect(result._model).toBe('mistral-small-latest');
    });

    it('surcharge le modèle avec la valeur de AI_MODEL', () => {
      const config = buildConfig({
        AI_PROVIDER: 'gemini',
        GEMINI_API_KEY: 'gk-123',
        AI_MODEL: 'gemini-1.5-pro',
      });

      const result = createAiProvider(config, logger) as any;

      expect(result._model).toBe('gemini-1.5-pro');
    });

    it('applique le modèle surchargé à tous les providers de la chaîne', () => {
      const config = buildConfig({
        AI_PROVIDERS: 'gemini,openai',
        GEMINI_API_KEY: 'gk-123',
        OPENAI_API_KEY: 'sk-123',
        AI_MODEL: 'custom-model',
      });

      const chain = createAiProvider(config, logger) as any;
      // ChainProvider expose _providers qui contient les instances réelles
      const [p1, p2] = chain._providers;

      expect(p1._model).toBe('custom-model');
      expect(p2._model).toBe('custom-model');
    });
  });

  // ─── Mode chaîne via AI_PROVIDERS ────────────────────────────────────────

  describe('mode chaîne via AI_PROVIDERS', () => {
    it('retourne un ChainProvider quand plusieurs providers sont configurés', () => {
      const config = buildConfig({
        AI_PROVIDERS: 'gemini,openai',
        GEMINI_API_KEY: 'gk-123',
        OPENAI_API_KEY: 'sk-123',
      });

      const result = createAiProvider(config, logger);

      expect(result?.name).toBe('gemini>openai');
    });

    it('inclut uniquement les providers dont la clé API est présente', () => {
      const config = buildConfig({
        AI_PROVIDERS: 'gemini,openai,anthropic',
        GEMINI_API_KEY: 'gk-123',
        // OPENAI_API_KEY absente
        ANTHROPIC_API_KEY: 'ak-123',
      });

      const result = createAiProvider(config, logger);

      expect(result?.name).toBe('gemini>anthropic');
    });

    it('retourne un provider unique (sans ChainProvider) si un seul provider a une clé valide', () => {
      const config = buildConfig({
        AI_PROVIDERS: 'gemini,openai',
        GEMINI_API_KEY: 'gk-123',
        // OPENAI_API_KEY absente
      });

      const result = createAiProvider(config, logger);

      expect(result?.name).toBe('gemini');
    });

    it('retourne null si aucun provider de la liste n\'a de clé API valide', () => {
      const config = buildConfig({
        AI_PROVIDERS: 'gemini,openai',
      });

      const result = createAiProvider(config, logger);

      expect(result).toBeNull();
    });

    it('logue un warn si aucune clé valide n\'est trouvée dans la liste', () => {
      const config = buildConfig({ AI_PROVIDERS: 'gemini,openai' });

      createAiProvider(config, logger);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Aucun provider'),
      );
    });

    it('ignore les providers inconnus dans AI_PROVIDERS et logue un warn', () => {
      const config = buildConfig({
        AI_PROVIDERS: 'gemini,cohere',
        GEMINI_API_KEY: 'gk-123',
      });

      const result = createAiProvider(config, logger);

      expect(result?.name).toBe('gemini');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('cohere'),
      );
    });

    it('ignore les espaces autour des noms dans AI_PROVIDERS', () => {
      const config = buildConfig({
        AI_PROVIDERS: ' gemini , openai ',
        GEMINI_API_KEY: 'gk-123',
        OPENAI_API_KEY: 'sk-123',
      });

      const result = createAiProvider(config, logger);

      expect(result?.name).toBe('gemini>openai');
    });

    it('AI_PROVIDERS a priorité sur AI_PROVIDER quand les deux sont définis', () => {
      const config = buildConfig({
        AI_PROVIDERS: 'gemini,openai',
        AI_PROVIDER: 'anthropic',
        GEMINI_API_KEY: 'gk-123',
        OPENAI_API_KEY: 'sk-123',
        ANTHROPIC_API_KEY: 'ak-123',
      });

      const result = createAiProvider(config, logger);

      expect(result?.name).toBe('gemini>openai');
    });

    it('logue le nom de la chaîne activée', () => {
      const config = buildConfig({
        AI_PROVIDERS: 'gemini,openai',
        GEMINI_API_KEY: 'gk-123',
        OPENAI_API_KEY: 'sk-123',
      });

      createAiProvider(config, logger);

      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('gemini>openai'),
      );
    });

    it('logue l\'activation du provider unique', () => {
      const config = buildConfig({
        AI_PROVIDER: 'gemini',
        GEMINI_API_KEY: 'gk-123',
      });

      createAiProvider(config, logger);

      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('gemini'),
      );
    });
  });
});
