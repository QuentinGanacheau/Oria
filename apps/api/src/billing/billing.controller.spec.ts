import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BillingController } from './billing.controller';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

// ─── Mock BillingService ──────────────────────────────────────────────────────

const billingMock = {
  isEnabled: vi.fn(),
  createFullReportCheckout: vi.fn(),
  verifyPaidSession: vi.fn(),
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('BillingController', () => {
  let controller: BillingController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new BillingController(billingMock as any);
  });

  // ─── configStatus ────────────────────────────────────────────────────────────

  describe('configStatus (GET /billing/status)', () => {
    it('retourne stripeEnabled: true quand le service indique que Stripe est actif', () => {
      billingMock.isEnabled.mockReturnValue(true);

      const result = controller.configStatus();

      expect(result).toEqual({ stripeEnabled: true });
    });

    it('retourne stripeEnabled: false quand le service indique que Stripe est inactif', () => {
      billingMock.isEnabled.mockReturnValue(false);

      const result = controller.configStatus();

      expect(result).toEqual({ stripeEnabled: false });
    });

    it('délègue l appel à billing.isEnabled', () => {
      billingMock.isEnabled.mockReturnValue(true);

      controller.configStatus();

      expect(billingMock.isEnabled).toHaveBeenCalledOnce();
    });
  });

  // ─── checkout ────────────────────────────────────────────────────────────────

  describe('checkout (POST /billing/checkout/full-report)', () => {
    it('retourne l URL fournie par le service', async () => {
      billingMock.createFullReportCheckout.mockResolvedValue({
        url: 'https://checkout.stripe.com/pay/abc',
      });
      const dto: CreateCheckoutDto = { successPath: '/resultats', cancelPath: '/annulation' };

      const result = await controller.checkout(dto);

      expect(result).toEqual({ url: 'https://checkout.stripe.com/pay/abc' });
    });

    it('transmet successPath et cancelPath au service', async () => {
      billingMock.createFullReportCheckout.mockResolvedValue({ url: 'https://stripe.com' });
      const dto: CreateCheckoutDto = { successPath: '/ok', cancelPath: '/ko' };

      await controller.checkout(dto);

      expect(billingMock.createFullReportCheckout).toHaveBeenCalledWith({
        successPath: '/ok',
        cancelPath: '/ko',
      });
    });

    it('transmet undefined pour les chemins non fournis dans le DTO', async () => {
      billingMock.createFullReportCheckout.mockResolvedValue({ url: 'https://stripe.com' });
      const dto: CreateCheckoutDto = {};

      await controller.checkout(dto);

      expect(billingMock.createFullReportCheckout).toHaveBeenCalledWith({
        successPath: undefined,
        cancelPath: undefined,
      });
    });

    it('propage l exception levée par le service', async () => {
      const error = new Error('Stripe indisponible');
      billingMock.createFullReportCheckout.mockRejectedValue(error);
      const dto: CreateCheckoutDto = {};

      await expect(controller.checkout(dto)).rejects.toThrow('Stripe indisponible');
    });
  });

  // ─── session ─────────────────────────────────────────────────────────────────

  describe('session (GET /billing/session)', () => {
    it('retourne paid: true quand le service confirme la session payée', async () => {
      billingMock.verifyPaidSession.mockResolvedValue({ paid: true });

      const result = await controller.session('cs_test_abc');

      expect(result).toEqual({ paid: true });
    });

    it('retourne paid: false quand le service indique session non payée', async () => {
      billingMock.verifyPaidSession.mockResolvedValue({ paid: false });

      const result = await controller.session('cs_test_abc');

      expect(result).toEqual({ paid: false });
    });

    it('retourne paid: false directement quand session_id est absent', async () => {
      const result = await controller.session('');

      expect(result).toEqual({ paid: false });
      expect(billingMock.verifyPaidSession).not.toHaveBeenCalled();
    });

    it('retourne paid: false directement quand session_id est undefined', async () => {
      const result = await controller.session(undefined as any);

      expect(result).toEqual({ paid: false });
      expect(billingMock.verifyPaidSession).not.toHaveBeenCalled();
    });

    it('transmet le sessionId au service', async () => {
      billingMock.verifyPaidSession.mockResolvedValue({ paid: true });

      await controller.session('cs_test_xyz');

      expect(billingMock.verifyPaidSession).toHaveBeenCalledWith('cs_test_xyz');
    });

    it('propage l exception levée par le service', async () => {
      const error = new Error('Erreur Stripe');
      billingMock.verifyPaidSession.mockRejectedValue(error);

      await expect(controller.session('cs_test_abc')).rejects.toThrow('Erreur Stripe');
    });
  });
});
