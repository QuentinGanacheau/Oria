import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PrismaService } from './prisma.service';

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(() => {
    service = new PrismaService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── onModuleInit ─────────────────────────────────────────────────────────

  describe('onModuleInit', () => {
    it('appelle $connect lors de l initialisation du module', async () => {
      const connectSpy = vi
        .spyOn(service, '$connect')
        .mockResolvedValue(undefined);

      await service.onModuleInit();

      expect(connectSpy).toHaveBeenCalledTimes(1);
    });

    it('propage l erreur si $connect échoue', async () => {
      const erreur = new Error('Connexion refusée');
      vi.spyOn(service, '$connect').mockRejectedValue(erreur);

      await expect(service.onModuleInit()).rejects.toThrow('Connexion refusée');
    });
  });

  // ─── enableShutdownHooks ──────────────────────────────────────────────────

  describe('enableShutdownHooks', () => {
    it('enregistre un listener sur l événement beforeExit du processus', async () => {
      const processOnSpy = vi.spyOn(process, 'on').mockImplementation(vi.fn() as any);
      const appMock = { close: vi.fn().mockResolvedValue(undefined) };

      await service.enableShutdownHooks(appMock as any);

      expect(processOnSpy).toHaveBeenCalledWith('beforeExit', expect.any(Function));
    });

    it('ferme l application NestJS lorsque beforeExit est déclenché', async () => {
      const appMock = { close: vi.fn().mockResolvedValue(undefined) };

      let capturedCallback: (() => Promise<void>) | undefined;
      vi.spyOn(process, 'on').mockImplementation((event: any, cb: any) => {
        if (event === 'beforeExit') {
          capturedCallback = cb;
        }
        return process;
      });

      await service.enableShutdownHooks(appMock as any);

      expect(capturedCallback).toBeDefined();
      await capturedCallback!();

      expect(appMock.close).toHaveBeenCalledTimes(1);
    });

    it('propage l erreur si app.close échoue lors du beforeExit', async () => {
      const erreur = new Error('Fermeture impossible');
      const appMock = { close: vi.fn().mockRejectedValue(erreur) };

      let capturedCallback: (() => Promise<void>) | undefined;
      vi.spyOn(process, 'on').mockImplementation((event: any, cb: any) => {
        if (event === 'beforeExit') {
          capturedCallback = cb;
        }
        return process;
      });

      await service.enableShutdownHooks(appMock as any);

      await expect(capturedCallback!()).rejects.toThrow('Fermeture impossible');
    });
  });

  // ─── Héritage PrismaClient ────────────────────────────────────────────────

  describe('héritage PrismaClient', () => {
    it('possède le bon constructeur (PrismaService)', () => {
      expect(service.constructor.name).toBe('PrismaService');
    });

    it('expose la méthode $connect héritée de PrismaClient', () => {
      expect(typeof service.$connect).toBe('function');
    });

    it('expose la méthode $disconnect héritée de PrismaClient', () => {
      expect(typeof service.$disconnect).toBe('function');
    });
  });
});
