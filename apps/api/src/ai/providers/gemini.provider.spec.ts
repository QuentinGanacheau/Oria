import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiProvider } from './gemini.provider';

// ─── Mock du SDK Google GenAI ─────────────────────────────────────────────────

const mockGenerateContent = vi.fn();

vi.mock('@google/genai', () => {
  class GoogleGenAIMock {
    models = { generateContent: mockGenerateContent };
    constructor(_opts: unknown) {}
  }
  return { GoogleGenAI: GoogleGenAIMock };
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildResponse(text: string | undefined) {
  return { text };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('GeminiProvider', () => {
  let provider: GeminiProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new GeminiProvider('test-api-key', 'gemini-2.0-flash');
  });

  // ─── Propriétés de base ───────────────────────────────────────────────────

  describe('propriétés de base', () => {
    it('expose le nom "gemini"', () => {
      expect(provider.name).toBe('gemini');
    });
  });

  // ─── Appel SDK ────────────────────────────────────────────────────────────

  describe('appel au SDK', () => {
    it('transmet le modèle, le prompt et la température par défaut au SDK', async () => {
      mockGenerateContent.mockResolvedValue(buildResponse('réponse ok'));

      await provider.complete({ prompt: 'Quel métier me convient ?' });

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-2.0-flash',
          contents: 'Quel métier me convient ?',
          config: expect.objectContaining({ temperature: 0.1 }),
        }),
      );
    });

    it('transmet la température fournie dans les options', async () => {
      mockGenerateContent.mockResolvedValue(buildResponse('ok'));

      await provider.complete({ prompt: 'Test', temperature: 0.8 });

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({ temperature: 0.8 }),
        }),
      );
    });

    it('inclut maxOutputTokens dans config si fourni', async () => {
      mockGenerateContent.mockResolvedValue(buildResponse('ok'));

      await provider.complete({ prompt: 'Test', maxOutputTokens: 256 });

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({ maxOutputTokens: 256 }),
        }),
      );
    });

    it('n\'inclut pas maxOutputTokens dans config si absent des options', async () => {
      mockGenerateContent.mockResolvedValue(buildResponse('ok'));

      await provider.complete({ prompt: 'Test' });

      const callArg = mockGenerateContent.mock.calls[0][0];
      expect(callArg.config).not.toHaveProperty('maxOutputTokens');
    });

    it('appelle le SDK exactement une fois par invocation de complete', async () => {
      mockGenerateContent.mockResolvedValue(buildResponse('ok'));

      await provider.complete({ prompt: 'Test' });

      expect(mockGenerateContent).toHaveBeenCalledOnce();
    });
  });

  // ─── Parsing de la réponse ────────────────────────────────────────────────

  describe('parsing de la réponse SDK', () => {
    it('retourne le texte de la réponse', async () => {
      mockGenerateContent.mockResolvedValue(buildResponse('Voici ma réponse'));

      const result = await provider.complete({ prompt: 'Test' });

      expect(result).toBe('Voici ma réponse');
    });

    it('trim les espaces autour du texte retourné', async () => {
      mockGenerateContent.mockResolvedValue(buildResponse('  texte avec espaces  '));

      const result = await provider.complete({ prompt: 'Test' });

      expect(result).toBe('texte avec espaces');
    });

    it('retourne une chaîne vide si text est undefined', async () => {
      mockGenerateContent.mockResolvedValue(buildResponse(undefined));

      const result = await provider.complete({ prompt: 'Test' });

      expect(result).toBe('');
    });

    it('retourne une chaîne vide si text est null', async () => {
      mockGenerateContent.mockResolvedValue({ text: null });

      const result = await provider.complete({ prompt: 'Test' });

      expect(result).toBe('');
    });
  });

  // ─── Gestion d'erreurs ────────────────────────────────────────────────────

  describe('gestion d\'erreurs', () => {
    it('propage l\'exception si le SDK lève une erreur', async () => {
      mockGenerateContent.mockRejectedValue(new Error('RESOURCE_EXHAUSTED'));

      await expect(provider.complete({ prompt: 'Test' })).rejects.toThrow(
        'RESOURCE_EXHAUSTED',
      );
    });

    it('propage une erreur 503 du SDK', async () => {
      mockGenerateContent.mockRejectedValue(new Error('503 Service Unavailable'));

      await expect(provider.complete({ prompt: 'Test' })).rejects.toThrow(
        '503 Service Unavailable',
      );
    });
  });
});
