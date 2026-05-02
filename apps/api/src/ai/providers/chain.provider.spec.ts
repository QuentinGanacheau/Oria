import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Logger } from '@nestjs/common';
import { ChainProvider } from './chain.provider';
import type { AiProvider } from './ai-provider.interface';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildProvider(name: string, response?: string, error?: Error): AiProvider {
  return {
    name,
    complete: error
      ? vi.fn().mockRejectedValue(error)
      : vi.fn().mockResolvedValue(response ?? 'réponse ok'),
  };
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

describe('ChainProvider', () => {
  let logger: Logger;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = buildLogger();
  });

  // ─── Propriétés de base ───────────────────────────────────────────────────

  describe('propriétés de base', () => {
    it('construit son nom en joignant les noms des providers par ">"', () => {
      const chain = new ChainProvider(
        [buildProvider('gemini'), buildProvider('openai'), buildProvider('anthropic')],
        logger,
      );

      expect(chain.name).toBe('gemini>openai>anthropic');
    });

    it('construit son nom avec un seul provider', () => {
      const chain = new ChainProvider([buildProvider('gemini')], logger);

      expect(chain.name).toBe('gemini');
    });
  });

  // ─── Happy path ───────────────────────────────────────────────────────────

  describe('appel au premier provider disponible', () => {
    it('retourne la réponse du premier provider si celui-ci réussit', async () => {
      const p1 = buildProvider('gemini', 'réponse gemini');
      const p2 = buildProvider('openai', 'réponse openai');
      const chain = new ChainProvider([p1, p2], logger);

      const result = await chain.complete({ prompt: 'Test' });

      expect(result).toBe('réponse gemini');
    });

    it('appelle uniquement le premier provider si celui-ci réussit', async () => {
      const p1 = buildProvider('gemini', 'réponse gemini');
      const p2 = buildProvider('openai', 'réponse openai');
      const chain = new ChainProvider([p1, p2], logger);

      await chain.complete({ prompt: 'Test' });

      expect(p1.complete).toHaveBeenCalledOnce();
      expect(p2.complete).not.toHaveBeenCalled();
    });

    it('transmet les options complètes au provider appelé', async () => {
      const p1 = buildProvider('gemini', 'ok');
      const chain = new ChainProvider([p1], logger);

      await chain.complete({ prompt: 'Mon prompt', temperature: 0.5, maxOutputTokens: 256 });

      expect(p1.complete).toHaveBeenCalledWith({
        prompt: 'Mon prompt',
        temperature: 0.5,
        maxOutputTokens: 256,
      });
    });

    it('ne logue pas de fallback si le premier provider répond', async () => {
      const chain = new ChainProvider(
        [buildProvider('gemini', 'ok'), buildProvider('openai', 'ok')],
        logger,
      );

      await chain.complete({ prompt: 'Test' });

      expect(logger.log).not.toHaveBeenCalled();
    });
  });

  // ─── Fallback ─────────────────────────────────────────────────────────────

  describe('fallback vers le provider suivant', () => {
    it('utilise le second provider si le premier échoue', async () => {
      const p1 = buildProvider('gemini', undefined, new Error('quota dépassé'));
      const p2 = buildProvider('openai', 'réponse openai');
      const chain = new ChainProvider([p1, p2], logger);

      const result = await chain.complete({ prompt: 'Test' });

      expect(result).toBe('réponse openai');
    });

    it('appelle le second provider si le premier échoue', async () => {
      const p1 = buildProvider('gemini', undefined, new Error('503'));
      const p2 = buildProvider('openai', 'ok');
      const chain = new ChainProvider([p1, p2], logger);

      await chain.complete({ prompt: 'Test' });

      expect(p1.complete).toHaveBeenCalledOnce();
      expect(p2.complete).toHaveBeenCalledOnce();
    });

    it('logue un warn quand le premier provider échoue', async () => {
      const p1 = buildProvider('gemini', undefined, new Error('quota dépassé'));
      const p2 = buildProvider('openai', 'ok');
      const chain = new ChainProvider([p1, p2], logger);

      await chain.complete({ prompt: 'Test' });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('gemini'),
      );
    });

    it('logue le fallback quand un provider de secours répond', async () => {
      const p1 = buildProvider('gemini', undefined, new Error('timeout'));
      const p2 = buildProvider('openai', 'réponse fallback');
      const chain = new ChainProvider([p1, p2], logger);

      await chain.complete({ prompt: 'Test' });

      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('openai'),
      );
    });

    it('enchaîne trois providers et utilise le troisième si les deux premiers échouent', async () => {
      const p1 = buildProvider('gemini', undefined, new Error('err1'));
      const p2 = buildProvider('openai', undefined, new Error('err2'));
      const p3 = buildProvider('anthropic', 'réponse anthropic');
      const chain = new ChainProvider([p1, p2, p3], logger);

      const result = await chain.complete({ prompt: 'Test' });

      expect(result).toBe('réponse anthropic');
      expect(p1.complete).toHaveBeenCalledOnce();
      expect(p2.complete).toHaveBeenCalledOnce();
      expect(p3.complete).toHaveBeenCalledOnce();
    });
  });

  // ─── Tous les providers en échec ─────────────────────────────────────────

  describe('tous les providers en échec', () => {
    it('lève la dernière erreur si tous les providers échouent', async () => {
      const p1 = buildProvider('gemini', undefined, new Error('erreur gemini'));
      const p2 = buildProvider('openai', undefined, new Error('erreur openai'));
      const chain = new ChainProvider([p1, p2], logger);

      await expect(chain.complete({ prompt: 'Test' })).rejects.toThrow(
        'erreur openai',
      );
    });

    it('lève une erreur générique si la liste de providers est vide', async () => {
      const chain = new ChainProvider([], logger);

      await expect(chain.complete({ prompt: 'Test' })).rejects.toThrow(
        'Tous les providers IA ont échoué.',
      );
    });

    it('logue un warn pour chaque provider en échec', async () => {
      const p1 = buildProvider('gemini', undefined, new Error('err1'));
      const p2 = buildProvider('openai', undefined, new Error('err2'));
      const chain = new ChainProvider([p1, p2], logger);

      await chain.complete({ prompt: 'Test' }).catch(() => {});

      expect(logger.warn).toHaveBeenCalledTimes(2);
    });
  });
});
