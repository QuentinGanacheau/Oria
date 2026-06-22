import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MistralProvider } from './mistral.provider';

// ─── Mock du SDK OpenAI (réutilisé par Mistral via baseURL) ───────────────────

const mockCreate = vi.fn();
const mockConstructor = vi.fn();

vi.mock('openai', () => {
  class OpenAIMock {
    chat = { completions: { create: mockCreate } };
    constructor(opts: unknown) {
      mockConstructor(opts);
    }
  }
  return { default: OpenAIMock };
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildResponse(content: string | null) {
  return { choices: [{ message: { content } }] };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('MistralProvider', () => {
  let provider: MistralProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new MistralProvider('test-api-key', 'mistral-small-latest');
  });

  // ─── Propriétés de base ───────────────────────────────────────────────────

  describe('propriétés de base', () => {
    it('expose le nom "mistral"', () => {
      expect(provider.name).toBe('mistral');
    });

    it('pointe le SDK OpenAI sur l\'endpoint Mistral', () => {
      expect(mockConstructor).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'test-api-key',
          baseURL: 'https://api.mistral.ai/v1',
        }),
      );
    });
  });

  // ─── Appel SDK ────────────────────────────────────────────────────────────

  describe('appel au SDK', () => {
    it('transmet le modèle, le prompt et la température par défaut au SDK', async () => {
      mockCreate.mockResolvedValue(buildResponse('réponse ok'));

      await provider.complete({ prompt: 'Quel métier me convient ?' });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'mistral-small-latest',
          temperature: 0.1,
          messages: [
            { role: 'user', content: 'Quel métier me convient ?' },
          ],
        }),
      );
    });

    it('transmet la température et maxOutputTokens fournis dans les options', async () => {
      mockCreate.mockResolvedValue(buildResponse('ok'));

      await provider.complete({ prompt: 'Test', temperature: 0.5, maxOutputTokens: 256 });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ temperature: 0.5, max_tokens: 256 }),
      );
    });

    it('appelle le SDK exactement une fois par invocation de complete', async () => {
      mockCreate.mockResolvedValue(buildResponse('ok'));

      await provider.complete({ prompt: 'Test' });

      expect(mockCreate).toHaveBeenCalledOnce();
    });
  });

  // ─── Parsing de la réponse ────────────────────────────────────────────────

  describe('parsing de la réponse SDK', () => {
    it('retourne le contenu du premier choix', async () => {
      mockCreate.mockResolvedValue(buildResponse('Voici ma réponse'));

      const result = await provider.complete({ prompt: 'Test' });

      expect(result).toBe('Voici ma réponse');
    });

    it('trim les espaces autour du texte retourné', async () => {
      mockCreate.mockResolvedValue(buildResponse('  texte avec espaces  '));

      const result = await provider.complete({ prompt: 'Test' });

      expect(result).toBe('texte avec espaces');
    });

    it('retourne une chaîne vide si le contenu est null', async () => {
      mockCreate.mockResolvedValue(buildResponse(null));

      const result = await provider.complete({ prompt: 'Test' });

      expect(result).toBe('');
    });

    it('retourne une chaîne vide si aucun choix n\'est retourné', async () => {
      mockCreate.mockResolvedValue({ choices: [] });

      const result = await provider.complete({ prompt: 'Test' });

      expect(result).toBe('');
    });
  });

  // ─── Gestion d'erreurs ────────────────────────────────────────────────────

  describe('gestion d\'erreurs', () => {
    it('propage l\'exception si le SDK lève une erreur', async () => {
      mockCreate.mockRejectedValue(new Error('quota exceeded'));

      await expect(provider.complete({ prompt: 'Test' })).rejects.toThrow(
        'quota exceeded',
      );
    });
  });
});
