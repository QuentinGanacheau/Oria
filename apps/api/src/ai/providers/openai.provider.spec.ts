import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAiProvider } from './openai.provider';

// ─── Mock du SDK OpenAI ───────────────────────────────────────────────────────

const mockCreate = vi.fn();

vi.mock('openai', () => {
  class OpenAIMock {
    responses = { create: mockCreate };
    constructor(_opts: unknown) {}
  }
  return { default: OpenAIMock };
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildResponse(outputText: string) {
  return { output_text: outputText };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('OpenAiProvider', () => {
  let provider: OpenAiProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new OpenAiProvider('test-api-key', 'gpt-4.1-mini');
  });

  // ─── Propriétés de base ───────────────────────────────────────────────────

  describe('propriétés de base', () => {
    it('expose le nom "openai"', () => {
      expect(provider.name).toBe('openai');
    });
  });

  // ─── Appel SDK ────────────────────────────────────────────────────────────

  describe('appel au SDK', () => {
    it('transmet le modèle, le prompt et la température par défaut au SDK', async () => {
      mockCreate.mockResolvedValue(buildResponse('réponse ok'));

      await provider.complete({ prompt: 'Quel métier me convient ?' });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4.1-mini',
          input: 'Quel métier me convient ?',
          temperature: 0.1,
        }),
      );
    });

    it('transmet la température fournie dans les options', async () => {
      mockCreate.mockResolvedValue(buildResponse('ok'));

      await provider.complete({ prompt: 'Test', temperature: 0.5 });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ temperature: 0.5 }),
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
    it('retourne le texte output_text de la réponse', async () => {
      mockCreate.mockResolvedValue(buildResponse('Voici ma réponse'));

      const result = await provider.complete({ prompt: 'Test' });

      expect(result).toBe('Voici ma réponse');
    });

    it('trim les espaces autour du texte retourné', async () => {
      mockCreate.mockResolvedValue(buildResponse('  texte avec espaces  '));

      const result = await provider.complete({ prompt: 'Test' });

      expect(result).toBe('texte avec espaces');
    });

    it('retourne une chaîne vide si output_text est null', async () => {
      mockCreate.mockResolvedValue({ output_text: null });

      const result = await provider.complete({ prompt: 'Test' });

      expect(result).toBe('');
    });

    it('retourne une chaîne vide si output_text est undefined', async () => {
      mockCreate.mockResolvedValue({});

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

    it('propage une erreur réseau du SDK', async () => {
      mockCreate.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(provider.complete({ prompt: 'Test' })).rejects.toThrow(
        'ECONNREFUSED',
      );
    });
  });
});
