import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class BillingService {
  private stripe: InstanceType<typeof Stripe> | null = null;

  constructor(private readonly config: ConfigService) {
    const key = this.config.get<string>('STRIPE_SECRET_KEY');
    if (key) {
      this.stripe = new Stripe(key, { apiVersion: '2026-03-25.dahlia' });
    }
  }

  isEnabled(): boolean {
    return this.stripe != null && !!this.config.get<string>('STRIPE_PRICE_FULL_REPORT');
  }

  async createFullReportCheckout(opts: {
    successPath?: string;
    cancelPath?: string;
  }): Promise<{ url: string }> {
    if (!this.stripe) {
      throw new ServiceUnavailableException({
        code: 'STRIPE_DISABLED',
        message: 'Paiement non configuré (STRIPE_SECRET_KEY manquant).',
      });
    }
    const priceId = this.config.get<string>('STRIPE_PRICE_FULL_REPORT');
    if (!priceId) {
      throw new ServiceUnavailableException({
        code: 'STRIPE_PRICE_MISSING',
        message: 'STRIPE_PRICE_FULL_REPORT manquant.',
      });
    }
    const base = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    const success =
      base.replace(/\/$/, '') +
      (opts.successPath?.startsWith('/') ? opts.successPath : `/${opts.successPath ?? 'resultats'}`) +
      '?session_id={CHECKOUT_SESSION_ID}';
    const cancel =
      base.replace(/\/$/, '') +
      (opts.cancelPath?.startsWith('/') ? opts.cancelPath : `/${opts.cancelPath ?? 'resultats'}`);

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: success,
      cancel_url: cancel,
    });
    if (!session.url) {
      throw new ServiceUnavailableException('Session Stripe sans URL.');
    }
    return { url: session.url };
  }

  async verifyPaidSession(sessionId: string): Promise<{ paid: boolean }> {
    if (!this.stripe) {
      return { paid: false };
    }
    const session = await this.stripe.checkout.sessions.retrieve(sessionId);
    return { paid: session.payment_status === 'paid' };
  }
}
