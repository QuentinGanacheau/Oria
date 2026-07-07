import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Vue partielle d'une Stripe.Checkout.Session — uniquement les champs
 * utilisés ici. Évite de dépendre du typage namespace Stripe (qui peut
 * varier entre versions du SDK) et documente précisément ce qu'on consomme.
 */
type StripeCheckoutSessionLike = {
  id: string;
  payment_status: string;
  amount_total: number | null;
  currency: string | null;
  metadata: Record<string, string> | null;
  customer_details: { email: string | null } | null;
};

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private stripe: InstanceType<typeof Stripe> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {
    const key = this.config.get<string>('STRIPE_SECRET_KEY');
    if (key) {
      this.stripe = new Stripe(key, { apiVersion: '2026-03-25.dahlia' });
    }
  }

  isEnabled(): boolean {
    return this.stripe != null && !!this.config.get<string>('STRIPE_PRICE_FULL_REPORT');
  }

  /**
   * Crée une session de checkout Stripe pour le rapport complet.
   *
   * Si `sessionId` (questionnaire) est fourni :
   *   - Stocké dans `metadata.questionnaireSessionId` pour pouvoir
   *     envoyer l'email de confirmation après paiement (cf verifyPaidSession).
   *   - Pré-remplit `customer_email` si on a déjà l'email en DB
   *     (capturé à l'itération email-gate) — réduit la friction au checkout.
   */
  async createFullReportCheckout(opts: {
    successPath?: string;
    cancelPath?: string;
    sessionId?: string;
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

    // Email obligatoire pour les sessions payantes :
    // on a besoin de l'email pour envoyer la confirmation et permettre la
    // restauration ultérieure des résultats débloqués.
    let customerEmail: string | undefined;
    const metadata: Record<string, string> = {};
    if (opts.sessionId) {
      metadata.questionnaireSessionId = opts.sessionId;
      const session = await this.prisma.questionnaireSession.findUnique({
        where: { id: opts.sessionId },
        select: { email: true },
      });

      if (!session?.email) {
        // L'utilisateur a skipé la capture email — on lui demande de le fournir
        // avant de procéder au paiement (code géré par le frontend).
        throw new ServiceUnavailableException({
          code: 'EMAIL_REQUIRED',
          message:
            'Un email est requis pour accéder à ton rapport complet et le retrouver plus tard.',
        });
      }

      customerEmail = session.email;
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: success,
      cancel_url: cancel,
      // On ne passe `metadata` que s'il y a vraiment quelque chose à stocker
      // (pas de pollution du payload Stripe avec des objets vides).
      ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
      ...(customerEmail ? { customer_email: customerEmail } : {}),
    });
    if (!session.url) {
      throw new ServiceUnavailableException('Session Stripe sans URL.');
    }
    return { url: session.url };
  }

  /**
   * Vérifie si une session Stripe a été payée et déclenche l'email de
   * confirmation si applicable.
   *
   * Appelée par le frontend après redirection depuis Stripe (avec session_id
   * dans l'URL). Effets de bord :
   *   - Si paid → envoie l'email de confirmation (idempotent : déduplication
   *     dans EmailService.sendPaymentConfirmation via EmailLog).
   *
   * @returns { paid: boolean }
   */
  async verifyPaidSession(stripeSessionId: string): Promise<{ paid: boolean }> {
    if (!this.stripe) {
      return { paid: false };
    }

    const session = await this.stripe.checkout.sessions.retrieve(stripeSessionId);
    const paid = session.payment_status === 'paid';

    if (paid) {
      const qSessionId = session.metadata?.questionnaireSessionId ?? null;

      // Prolonge l'accès à 1 an + marque la session comme payée.
      // Idempotent : si déjà fait (rechargement de page), la mise à jour
      // ne change rien de significatif.
      if (qSessionId) {
        const oneYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
        await this.prisma.questionnaireSession.update({
          where: { id: qSessionId },
          data: { isPaid: true, expiresAt: oneYear },
        }).catch((err) => {
          this.logger.error(
            `Impossible de marquer la session ${qSessionId} comme payée : ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        });
      }

      // Best-effort : on ne fait pas planter le retour HTTP si l'email échoue.
      void this.sendPaymentConfirmationFromStripeSession(session).catch((err) => {
        this.logger.error(
          `Erreur inattendue lors de l'envoi de la confirmation : ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      });
    }

    return { paid };
  }

  /**
   * Extrait les infos de la session Stripe et déclenche l'email.
   *
   * Sources d'email (par ordre de préférence) :
   *   1. Session questionnaire en DB (si lié via metadata.questionnaireSessionId)
   *   2. customer_details.email collecté par Stripe au checkout
   * Sans email exploitable → on n'envoie rien (log d'avertissement).
   */
  private async sendPaymentConfirmationFromStripeSession(
    stripeSession: StripeCheckoutSessionLike,
  ): Promise<void> {
    const questionnaireSessionId =
      stripeSession.metadata?.questionnaireSessionId ?? null;

    let to: string | null = null;

    if (questionnaireSessionId) {
      const dbSession = await this.prisma.questionnaireSession.findUnique({
        where: { id: questionnaireSessionId },
        select: {
          email: true,
        },
      });
      to = dbSession?.email ?? null;
    }

    // Fallback sur l'email collecté par Stripe au checkout
    if (!to) {
      to = stripeSession.customer_details?.email ?? null;
    }

    if (!to) {
      this.logger.warn(
        `Pas d'email exploitable pour la confirmation Stripe ${stripeSession.id}.`,
      );
      return;
    }

    if (!questionnaireSessionId) {
      // Sans sessionId, on ne peut pas dédupliquer proprement via EmailLog.
      // On envoie quand même mais on log un warning : ça veut dire que le
      // checkout a été créé sans passer par le flow questionnaire normal.
      this.logger.warn(
        `Confirmation Stripe ${stripeSession.id} sans questionnaireSessionId — envoi unique non garanti.`,
      );
    }

    await this.email.sendPaymentConfirmation({
      sessionId: questionnaireSessionId ?? stripeSession.id,
      to,
      amountTotalCents: stripeSession.amount_total ?? 0,
      currency: stripeSession.currency ?? 'eur',
    });
  }
}
