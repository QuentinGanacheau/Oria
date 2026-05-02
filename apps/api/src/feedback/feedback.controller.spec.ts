import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeedbackController } from './feedback.controller';
import type { CreateFeedbackDto } from './dto/create-feedback.dto';

// ─── Mock FeedbackService ─────────────────────────────────────────────────────

const feedbackServiceMock = {
  create: vi.fn(),
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

describe('FeedbackController', () => {
  let controller: FeedbackController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new FeedbackController(feedbackServiceMock as any);
  });

  // ─── Délégation au service ────────────────────────────────────────────────

  describe('create — délégation au service', () => {
    it('appelle feedbackService.create avec le body reçu', async () => {
      const dto = buildDto({ sessionId: 'sess-1', eventType: 'job_clicked' });
      feedbackServiceMock.create.mockResolvedValue(buildCreatedEvent(dto));

      await controller.create(dto);

      expect(feedbackServiceMock.create).toHaveBeenCalledOnce();
      expect(feedbackServiceMock.create).toHaveBeenCalledWith(dto);
    });

    it('retourne directement le résultat du service', async () => {
      const dto = buildDto({ eventType: 'rating_submitted', rating: 5 });
      const expected = buildCreatedEvent(dto);
      feedbackServiceMock.create.mockResolvedValue(expected);

      const result = await controller.create(dto);

      expect(result).toEqual(expected);
    });
  });

  // ─── Transmission fidèle du body ──────────────────────────────────────────

  describe('create — transmission fidèle du body', () => {
    it('transmet l intégralité des champs optionnels du DTO au service', async () => {
      const dto = buildDto({
        sessionId: 'sess-full',
        eventType: 'conversion',
        rating: 3,
        selectedJob: 'M1805',
        payload: { origin: 'homepage' },
      });
      feedbackServiceMock.create.mockResolvedValue(buildCreatedEvent(dto));

      await controller.create(dto);

      expect(feedbackServiceMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'sess-full',
          eventType: 'conversion',
          rating: 3,
          selectedJob: 'M1805',
          payload: { origin: 'homepage' },
        }),
      );
    });

    it('transmet un DTO minimal (seul eventType présent) sans altération', async () => {
      const dto = buildDto({ eventType: 'result_viewed' });
      feedbackServiceMock.create.mockResolvedValue(buildCreatedEvent(dto));

      await controller.create(dto);

      expect(feedbackServiceMock.create).toHaveBeenCalledWith(dto);
    });
  });

  // ─── Tous les types d'événement ───────────────────────────────────────────

  describe('create — tous les types d événement', () => {
    const eventTypes = [
      'result_viewed',
      'job_clicked',
      'rating_submitted',
      'conversion',
    ] as const;

    for (const eventType of eventTypes) {
      it(`délègue correctement l événement de type "${eventType}" au service`, async () => {
        const dto = buildDto({ eventType });
        feedbackServiceMock.create.mockResolvedValue(buildCreatedEvent(dto));

        await controller.create(dto);

        expect(feedbackServiceMock.create).toHaveBeenCalledWith(
          expect.objectContaining({ eventType }),
        );
      });
    }
  });

  // ─── Propagation des erreurs ──────────────────────────────────────────────

  describe('create — propagation des erreurs', () => {
    it('propage l erreur levée par le service sans la masquer', async () => {
      const dto = buildDto({ eventType: 'result_viewed' });
      feedbackServiceMock.create.mockRejectedValue(new Error('Service unavailable'));

      await expect(controller.create(dto)).rejects.toThrow('Service unavailable');
    });
  });
});
