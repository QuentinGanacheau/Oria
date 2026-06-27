import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JobsController } from './jobs.controller';
import type { JobProfile } from './jobs.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const buildJobProfile = (slug: string, title: string): JobProfile => ({
  slug,
  title,
  tagline: 'Informatique',
  summary: 'Résumé du métier',
  missions: ['Mission 1'],
  skills: ['Compétence 1'],
  formations: ['Bac+2'],
  salaryRangeHint: '',
  workContext: 'Bureau',
  recruitmentLevel: null,
  offerCount: null,
});

// ─── Mock service ─────────────────────────────────────────────────────────────

const jobsServiceMock = {
  findAll: vi.fn(),
  findBySlug: vi.fn(),
  getPersonalizedSheet: vi.fn(),
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('JobsController', () => {
  let controller: JobsController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new JobsController(jobsServiceMock as any);
  });

  // ─── GET / ────────────────────────────────────────────────────────────────

  describe('list()', () => {
    it('retourne la liste complète des métiers', async () => {
      const jobs = [
        buildJobProfile('M1805', 'Études informatiques'),
        buildJobProfile('M1801', 'Architecture SI'),
      ];
      jobsServiceMock.findAll.mockResolvedValue(jobs);

      const result = await controller.list();

      expect(result).toEqual(jobs);
      expect(jobsServiceMock.findAll).toHaveBeenCalledOnce();
    });

    it('retourne un tableau vide si aucun métier n existe', async () => {
      jobsServiceMock.findAll.mockResolvedValue([]);

      const result = await controller.list();

      expect(result).toEqual([]);
    });

    it('propage l erreur si le service échoue', async () => {
      jobsServiceMock.findAll.mockRejectedValue(new Error('DB error'));

      await expect(controller.list()).rejects.toThrow('DB error');
    });
  });

  // ─── GET /:slug ───────────────────────────────────────────────────────────

  describe('getOne()', () => {
    it('retourne le profil du métier correspondant au slug', async () => {
      const job = buildJobProfile('M1805', 'Études informatiques');
      jobsServiceMock.findBySlug.mockResolvedValue(job);

      const result = await controller.getOne('M1805');

      expect(result).toEqual(job);
      expect(jobsServiceMock.findBySlug).toHaveBeenCalledWith('M1805');
    });

    it('propage la NotFoundException si le métier est introuvable', async () => {
      jobsServiceMock.findBySlug.mockRejectedValue(
        new NotFoundException('Métier introuvable : INCONNU'),
      );

      await expect(controller.getOne('INCONNU')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('transmet le slug tel quel au service', async () => {
      const job = buildJobProfile('K2401', 'Animation socioculturelle');
      jobsServiceMock.findBySlug.mockResolvedValue(job);

      await controller.getOne('K2401');

      expect(jobsServiceMock.findBySlug).toHaveBeenCalledWith('K2401');
    });
  });

  // ─── GET /:slug/sheet ─────────────────────────────────────────────────────

  describe('getPersonalizedSheet()', () => {
    it('retourne le contenu personnalisé enveloppé dans { content }', async () => {
      const sheetContent = { headline: 'Super métier pour toi', body: '...' };
      jobsServiceMock.getPersonalizedSheet.mockResolvedValue(sheetContent);

      const result = await controller.getPersonalizedSheet(
        'M1805',
        'session-abc',
      );

      expect(result).toEqual({ content: sheetContent });
      expect(jobsServiceMock.getPersonalizedSheet).toHaveBeenCalledWith(
        'M1805',
        'session-abc',
      );
    });

    it('retourne { content: null } si le service retourne null', async () => {
      jobsServiceMock.getPersonalizedSheet.mockResolvedValue(null);

      const result = await controller.getPersonalizedSheet(
        'M1805',
        'session-xyz',
      );

      expect(result).toEqual({ content: null });
    });

    it('lève BadRequestException si sessionId est absent (undefined)', async () => {
      await expect(
        controller.getPersonalizedSheet('M1805', undefined),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève BadRequestException si sessionId est une chaîne vide', async () => {
      await expect(
        controller.getPersonalizedSheet('M1805', ''),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève BadRequestException si sessionId ne contient que des espaces', async () => {
      await expect(
        controller.getPersonalizedSheet('M1805', '   '),
      ).rejects.toThrow(BadRequestException);
    });

    it('trimme le sessionId avant de l envoyer au service', async () => {
      jobsServiceMock.getPersonalizedSheet.mockResolvedValue(null);

      await controller.getPersonalizedSheet('M1805', '  session-trim  ');

      expect(jobsServiceMock.getPersonalizedSheet).toHaveBeenCalledWith(
        'M1805',
        'session-trim',
      );
    });

    it('propage la NotFoundException si le slug est inconnu', async () => {
      jobsServiceMock.getPersonalizedSheet.mockRejectedValue(
        new NotFoundException('Métier introuvable : BAD'),
      );

      await expect(
        controller.getPersonalizedSheet('BAD', 'session-abc'),
      ).rejects.toThrow(NotFoundException);
    });

    it('ne appelle pas le service si sessionId est invalide', async () => {
      await expect(
        controller.getPersonalizedSheet('M1805', ''),
      ).rejects.toThrow(BadRequestException);

      expect(jobsServiceMock.getPersonalizedSheet).not.toHaveBeenCalled();
    });
  });
});
