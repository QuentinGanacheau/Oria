import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceUnavailableException } from '@nestjs/common';
import { BillingService } from './billing.service';

// ─── Mock Stripe ──────────────────────────────────────────────────────────────

const mockSessionCreate = vi.fn();
const mockSessionRetrieve = vi.fn();

const stripeInstance = {
  checkout: {
    sessions: {
      create: mockSessionCreate,
      retrieve: mockSessionRetrieve,
    },
  },
};

vi.mock('stripe', () => {
  return {
    default: function StripeConstructor() {
      return stripeInstance;
    },
  };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const buildConfig = (overrides: Record<string, string | undefined> = {}) => {
  const defaults: Record<string, string | undefined> = {
    STRIPE_SECRET_KEY: 'sk_test_123',
    STRIPE_PRICE_FULL_REPORT: 'price_abc',
    FRONTEND_URL: 'http://localhost:3000',
  };
  const values = { ...defaults, ...overrides };
  return {
    get: vi.fn((key: string) => values[key]),
  };
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('BillingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── isEnabled ──────────────────────────────────────────────────────────────

  describe('isEnabled', () => {
    it('retourne true quand Stripe est configuré et le priceId présent', () => {
      const service = new BillingService(buildConfig() as any);

      expect(service.isEnabled()).toBe(true);
    });

    it('retourne false quand STRIPE_SECRET_KEY est absent', () => {
      const service = new BillingService(
        buildConfig({ STRIPE_SECRET_KEY: undefined }) as any,
      );

      expect(service.isEnabled()).toBe(false);
    });

    it('retourne false quand STRIPE_PRICE_FULL_REPORT est absent', () => {
      const service = new BillingService(
        buildConfig({ STRIPE_PRICE_FULL_REPORT: undefined }) as any,
      );

      expect(service.isEnabled()).toBe(false);
    });

    it('retourne false quand les deux variables sont absentes', () => {
      const service = new BillingService(
        buildConfig({
          STRIPE_SECRET_KEY: undefined,
          STRIPE_PRICE_FULL_REPORT: undefined,
        }) as any,
      );

      expect(service.isEnabled()).toBe(false);
    });
  });

  // ─── createFullReportCheckout ────────────────────────────────────────────────

  describe('createFullReportCheckout', () => {
    it('retourne l URL de session Stripe en cas nominal', async () => {
      mockSessionCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/pay/abc' });
      const service = new BillingService(buildConfig() as any);

      const result = await service.createFullReportCheckout({});

      expect(result).toEqual({ url: 'https://checkout.stripe.com/pay/abc' });
    });

    it('appelle stripe.checkout.sessions.create avec les bons paramètres', async () => {
      mockSessionCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/pay/abc' });
      const service = new BillingService(buildConfig() as any);

      await service.createFullReportCheckout({
        successPath: '/resultats',
        cancelPath: '/annulation',
      });

      expect(mockSessionCreate).toHaveBeenCalledWith({
        mode: 'payment',
        line_items: [{ price: 'price_abc', quantity: 1 }],
        success_url: 'http://localhost:3000/resultats?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: 'http://localhost:3000/annulation',
      });
    });

    it('construit les URL avec des chemins commençant par /', async () => {
      mockSessionCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/pay/abc' });
      const service = new BillingService(buildConfig() as any);

      await service.createFullReportCheckout({
        successPath: '/success',
        cancelPath: '/cancel',
      });

      const call = mockSessionCreate.mock.calls[0][0];
      expect(call.success_url).toBe('http://localhost:3000/success?session_id={CHECKOUT_SESSION_ID}');
      expect(call.cancel_url).toBe('http://localhost:3000/cancel');
    });

    it('préfixe un / au chemin quand il ne commence pas par /', async () => {
      mockSessionCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/pay/abc' });
      const service = new BillingService(buildConfig() as any);

      await service.createFullReportCheckout({
        successPath: 'success',
        cancelPath: 'cancel',
      });

      const call = mockSessionCreate.mock.calls[0][0];
      expect(call.success_url).toBe('http://localhost:3000/success?session_id={CHECKOUT_SESSION_ID}');
      expect(call.cancel_url).toBe('http://localhost:3000/cancel');
    });

    it('utilise /resultats comme chemin par défaut quand successPath et cancelPath sont omis', async () => {
      mockSessionCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/pay/abc' });
      const service = new BillingService(buildConfig() as any);

      await service.createFullReportCheckout({});

      const call = mockSessionCreate.mock.calls[0][0];
      expect(call.success_url).toBe('http://localhost:3000/resultats?session_id={CHECKOUT_SESSION_ID}');
      expect(call.cancel_url).toBe('http://localhost:3000/resultats');
    });

    it('supprime le slash final de FRONTEND_URL avant de concaténer', async () => {
      mockSessionCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/pay/abc' });
      const service = new BillingService(
        buildConfig({ FRONTEND_URL: 'http://localhost:3000/' }) as any,
      );

      await service.createFullReportCheckout({ successPath: '/ok' });

      const call = mockSessionCreate.mock.calls[0][0];
      expect(call.success_url).toBe('http://localhost:3000/ok?session_id={CHECKOUT_SESSION_ID}');
    });

    it('utilise http://localhost:3000 comme base par défaut quand FRONTEND_URL est absent', async () => {
      mockSessionCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/pay/abc' });
      const service = new BillingService(
        buildConfig({ FRONTEND_URL: undefined }) as any,
      );

      await service.createFullReportCheckout({ successPath: '/ok' });

      const call = mockSessionCreate.mock.calls[0][0];
      expect(call.success_url).toContain('http://localhost:3000/ok');
    });

    it('lève ServiceUnavailableException avec code STRIPE_DISABLED quand Stripe n est pas configuré', async () => {
      const service = new BillingService(
        buildConfig({ STRIPE_SECRET_KEY: undefined }) as any,
      );

      await expect(service.createFullReportCheckout({})).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('inclut le code STRIPE_DISABLED dans l exception quand Stripe est absent', async () => {
      const service = new BillingService(
        buildConfig({ STRIPE_SECRET_KEY: undefined }) as any,
      );

      await expect(service.createFullReportCheckout({})).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'STRIPE_DISABLED' }),
      });
    });

    it('lève ServiceUnavailableException avec code STRIPE_PRICE_MISSING quand le priceId est absent', async () => {
      const service = new BillingService(
        buildConfig({ STRIPE_PRICE_FULL_REPORT: undefined }) as any,
      );

      await expect(service.createFullReportCheckout({})).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'STRIPE_PRICE_MISSING' }),
      });
    });

    it('lève ServiceUnavailableException quand la session Stripe n a pas d URL', async () => {
      mockSessionCreate.mockResolvedValue({ url: null });
      const service = new BillingService(buildConfig() as any);

      await expect(service.createFullReportCheckout({})).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  // ─── verifyPaidSession ───────────────────────────────────────────────────────

  describe('verifyPaidSession', () => {
    it('retourne paid: true quand payment_status est paid', async () => {
      mockSessionRetrieve.mockResolvedValue({ payment_status: 'paid' });
      const service = new BillingService(buildConfig() as any);

      const result = await service.verifyPaidSession('cs_test_abc');

      expect(result).toEqual({ paid: true });
    });

    it('retourne paid: false quand payment_status est unpaid', async () => {
      mockSessionRetrieve.mockResolvedValue({ payment_status: 'unpaid' });
      const service = new BillingService(buildConfig() as any);

      const result = await service.verifyPaidSession('cs_test_abc');

      expect(result).toEqual({ paid: false });
    });

    it('retourne paid: false quand payment_status est no_payment_required', async () => {
      mockSessionRetrieve.mockResolvedValue({ payment_status: 'no_payment_required' });
      const service = new BillingService(buildConfig() as any);

      const result = await service.verifyPaidSession('cs_test_abc');

      expect(result).toEqual({ paid: false });
    });

    it('retourne paid: false sans appeler Stripe quand Stripe n est pas configuré', async () => {
      const service = new BillingService(
        buildConfig({ STRIPE_SECRET_KEY: undefined }) as any,
      );

      const result = await service.verifyPaidSession('cs_test_abc');

      expect(result).toEqual({ paid: false });
      expect(mockSessionRetrieve).not.toHaveBeenCalled();
    });

    it('transmet le sessionId à stripe.checkout.sessions.retrieve', async () => {
      mockSessionRetrieve.mockResolvedValue({ payment_status: 'paid' });
      const service = new BillingService(buildConfig() as any);

      await service.verifyPaidSession('cs_test_xyz');

      expect(mockSessionRetrieve).toHaveBeenCalledWith('cs_test_xyz');
    });
  });
});
