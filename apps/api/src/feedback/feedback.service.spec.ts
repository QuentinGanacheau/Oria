import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeedbackService } from './feedback.service';
import type { CreateFeedbackDto } from './dto/create-feedback.dto';

// ─── Mock Prisma ──────────────────────────────────────────────────────────────

const prismaMock = {
  feedbackEvent: {
    create: vi.fn(),
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const buildDto = (overrides: Partial<CreateFeedbackDto> = {}): CreateFeedbackDto => ({
  eventType: 'result_viewed',
  ...overrides,
});

const buildCreatedEvent = (dto: CreateFeedbackDto, id = 'cuid-1') => ({
  id,
  sessionId: dto.sessionId ?? null,
  eventType: dto.eventType,
  rating: dto.rating ?? null,
  selectedJob: dto.selectedJob ?? null,
  payload: dto.payload ?? {},
  createdAt: new Date('2026-05-02T00:00:00.000Z'),
});

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('FeedbackService', () => {
  let service: FeedbackService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FeedbackService(prismaMock as any);
  });

  // ─── Création — cas nominaux ──────────────────────────────────────────────

  describe('create — cas nominaux', () => {
    it('appelle prisma.feedbackEvent.create avec les données du DTO', async () => {
      const dto = buildDto({ sessionId: 'session-abc', eventType: 'result_viewed' });
      prismaMock.feedbackEvent.create.mockResolvedValue(buildCreatedEvent(dto));

      await service.create(dto);

      expect(prismaMock.feedbackEvent.create).toHaveBeenCalledOnce();
      expect(prismaMock.feedbackEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sessionId: 'session-abc',
            eventType: 'result_viewed',
          }),
        }),
      );
    });

    it('retourne l entité créée par Prisma', async () => {
      const dto = buildDto({ eventType: 'job_clicked', selectedJob: 'M1805' });
      const expected = buildCreatedEvent(dto);
      prismaMock.feedbackEvent.create.mockResolvedValue(expected);

      const result = await service.create(dto);

      expect(result).toEqual(expected);
    });

    it('transmet le sessionId quand il est fourni', async () => {
      const dto = buildDto({ sessionId: 'sess-xyz', eventType: 'job_clicked' });
      prismaMock.feedbackEvent.create.mockResolvedValue(buildCreatedEvent(dto));

      await service.create(dto);

      expect(prismaMock.feedbackEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ sessionId: 'sess-xyz' }),
        }),
      );
    });

    it('transmet le rating quand il est fourni', async () => {
      const dto = buildDto({ eventType: 'rating_submitted', rating: 4 });
      prismaMock.feedbackEvent.create.mockResolvedValue(buildCreatedEvent(dto));

      await service.create(dto);

      expect(prismaMock.feedbackEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ rating: 4 }),
        }),
      );
    });

    it('transmet selectedJob quand il est fourni', async () => {
      const dto = buildDto({ eventType: 'job_clicked', selectedJob: 'M1801' });
      prismaMock.feedbackEvent.create.mockResolvedValue(buildCreatedEvent(dto));

      await service.create(dto);

      expect(prismaMock.feedbackEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ selectedJob: 'M1801' }),
        }),
      );
    });

    it('transmet le payload quand il est fourni', async () => {
      const dto = buildDto({
        eventType: 'conversion',
        payload: { source: 'landing', step: 3 },
      });
      prismaMock.feedbackEvent.create.mockResolvedValue(buildCreatedEvent(dto));

      await service.create(dto);

      expect(prismaMock.feedbackEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ payload: { source: 'landing', step: 3 } }),
        }),
      );
    });
  });

  // ─── Création — payload absent ────────────────────────────────────────────

  describe('create — payload absent', () => {
    it('utilise un objet vide comme payload quand payload est undefined', async () => {
      const dto = buildDto({ eventType: 'result_viewed' });
      // dto.payload est undefined
      prismaMock.feedbackEvent.create.mockResolvedValue(buildCreatedEvent(dto));

      await service.create(dto);

      expect(prismaMock.feedbackEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ payload: {} }),
        }),
      );
    });

    it('utilise un objet vide comme payload quand payload est null', async () => {
      const dto = buildDto({ eventType: 'result_viewed', payload: undefined });
      prismaMock.feedbackEvent.create.mockResolvedValue(buildCreatedEvent(dto));

      await service.create(dto);

      expect(prismaMock.feedbackEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ payload: {} }),
        }),
      );
    });
  });

  // ─── Tous les types d'événement ───────────────────────────────────────────

  describe('create — tous les types d événement supportés', () => {
    const eventTypes = [
      'result_viewed',
      'job_clicked',
      'rating_submitted',
      'conversion',
    ] as const;

    for (const eventType of eventTypes) {
      it(`enregistre correctement l événement de type "${eventType}"`, async () => {
        const dto = buildDto({ eventType });
        prismaMock.feedbackEvent.create.mockResolvedValue(buildCreatedEvent(dto));

        await service.create(dto);

        expect(prismaMock.feedbackEvent.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ eventType }),
          }),
        );
      });
    }
  });

  // ─── Propagation des erreurs Prisma ──────────────────────────────────────

  describe('create — erreurs Prisma', () => {
    it('propage l erreur si Prisma lève une exception', async () => {
      const dto = buildDto({ eventType: 'result_viewed' });
      prismaMock.feedbackEvent.create.mockRejectedValue(new Error('DB connection lost'));

      await expect(service.create(dto)).rejects.toThrow('DB connection lost');
    });
  });
});
