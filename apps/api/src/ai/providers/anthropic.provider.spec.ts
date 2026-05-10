import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnthropicProvider } from './anthropic.provider';

// ─── Mock du SDK Anthropic ───────────────────────────────────────────────────

const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  class AnthropicMock {
    messages = { create: mockCreate };
    constructor(_opts: unknown) {}
  }
  return { default: AnthropicMock };
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildTextResponse(text: string) {
  return {
    content: [{ type: 'text', text }],
  };
}

function buildMixedResponse(blocks: Array<{ type: string; text?: string }>) {
  return { content: blocks };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new AnthropicProvider('test-api-key', 'claude-haiku-4-5');
  });

  // ─── Propriétés de base ───────────────────────────────────────────────────

  describe('propriétés de base', () => {
    it('expose le nom "anthropic"', () => {
      expect(provider.name).toBe('anthropic');
    });
  });

  // ─── Appel SDK ────────────────────────────────────────────────────────────

  describe('appel au SDK', () => {
    it('transmet le modèle, le prompt et la température par défaut au SDK', async () => {
      mockCreate.mockResolvedValue(buildTextResponse('réponse ok'));

      await provider.complete({ prompt: 'Quel est ton métier ?' });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-haiku-4-5',
          messages: [{ role: 'user', content: 'Quel est ton métier ?' }],
          temperature: 0.1,
        }),
      );
    });

    it('utilise max_tokens par défaut à 1024 si non fourni', async () => {
      mockCreate.mockResolvedValue(buildTextResponse('ok'));

      await provider.complete({ prompt: 'Test' });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ max_tokens: 1024 }),
      );
    });

    it('transmet maxOutputTokens fourni dans les options', async () => {
      mockCreate.mockResolvedValue(buildTextResponse('ok'));

      await provider.complete({ prompt: 'Test', maxOutputTokens: 512 });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ max_tokens: 512 }),
      );
    });

    it('transmet la température fournie dans les options', async () => {
      mockCreate.mockResolvedValue(buildTextResponse('ok'));

      await provider.complete({ prompt: 'Test', temperature: 0.7 });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ temperature: 0.7 }),
      );
    });
  });

  // ─── Parsing de la réponse ────────────────────────────────────────────────

  describe('parsing de la réponse SDK', () => {
    it('retourne le texte du bloc text de la réponse', async () => {
      mockCreate.mockResolvedValue(buildTextResponse('Bonjour le monde'));

      const result = await provider.complete({ prompt: 'Test' });

      expect(result).toBe('Bonjour le monde');
    });

    it('trim les espaces autour de la réponse', async () => {
      mockCreate.mockResolvedValue(buildTextResponse('  réponse avec espaces  '));

      const result = await provider.complete({ prompt: 'Test' });

      expect(result).toBe('réponse avec espaces');
    });

    it('agrège plusieurs blocs texte en une seule chaîne', async () => {
      mockCreate.mockResolvedValue(
        buildMixedResponse([
          { type: 'text', text: 'Première partie. ' },
          { type: 'text', text: 'Deuxième partie.' },
        ]),
      );

      const result = await provider.complete({ prompt: 'Test' });

      expect(result).toBe('Première partie. Deuxième partie.');
    });

    it('ignore les blocs non-texte (ex: tool_use) et ne retourne que le texte', async () => {
      mockCreate.mockResolvedValue(
        buildMixedResponse([
          { type: 'tool_use' },
          { type: 'text', text: 'Seul le texte compte.' },
        ]),
      );

      const result = await provider.complete({ prompt: 'Test' });

      expect(result).toBe('Seul le texte compte.');
    });

    it('retourne une chaîne vide si la réponse ne contient aucun bloc texte', async () => {
      mockCreate.mockResolvedValue(buildMixedResponse([{ type: 'tool_use' }]));

      const result = await provider.complete({ prompt: 'Test' });

      expect(result).toBe('');
    });
  });

  // ─── Gestion d'erreurs ────────────────────────────────────────────────────

  describe('gestion d\'erreurs', () => {
    it('propage l\'exception si le SDK lève une erreur', async () => {
      mockCreate.mockRejectedValue(new Error('API rate limit exceeded'));

      await expect(provider.complete({ prompt: 'Test' })).rejects.toThrow(
        'API rate limit exceeded',
      );
    });

    it('propage une erreur réseau du SDK', async () => {
      mockCreate.mockRejectedValue(new Error('Network error'));

      await expect(provider.complete({ prompt: 'Test' })).rejects.toThrow(
        'Network error',
      );
    });
  });
});
