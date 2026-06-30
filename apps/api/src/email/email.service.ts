import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { PrismaService } from '../prisma/prisma.service';
import { buildPaymentEmail } from './templates/payment.template';
import { buildResultsEmail } from './templates/results.template';

/**
 * Service d'envoi d'emails — wrapper autour de Resend.
 *
 * Tous les envois sont logués en DB (table EmailLog) pour faciliter le
 * débogage / support utilisateur. Aucune fonction ne lève d'exception :
 * un échec d'email est inscrit en log et le code appelant continue.
 *
 * Configuration via ENV :
 *   - RESEND_API_KEY : clé API Resend (re_xxx)
 *   - EMAIL_FROM     : adresse expéditrice (ex: "Oryam <noreply@oryam.fr>")
 *                      → en mode test, utiliser "onboarding@resend.dev"
 *   - FRONTEND_URL   : pour construire les liens dans les emails
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;
  private readonly frontendUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const apiKey = config.get<string>('RESEND_API_KEY')?.trim();
    this.from =
      config.get<string>('EMAIL_FROM')?.trim() ?? 'onboarding@resend.dev';
    this.frontendUrl =
      config.get<string>('FRONTEND_URL')?.trim() ?? 'http://localhost:3000';

    if (!apiKey) {
      this.resend = null;
      this.logger.warn(
        'RESEND_API_KEY absente — envois email désactivés (mode dégradé).',
      );
      return;
    }

    this.resend = new Resend(apiKey);
    this.logger.log(`Email service prêt — expéditeur : ${this.from}`);
  }

  /** Indique si l'envoi d'email est configuré (clé API présente). */
  isEnabled(): boolean {
    return this.resend !== null;
  }

  /**
   * Envoie l'email de résultats à l'utilisateur après complétion du questionnaire.
   *
   * - Construit le template à partir des top métiers
   * - Envoie via Resend
   * - Log le résultat (succès / échec) en DB
   *
   * @returns true si l'email a bien été envoyé, false sinon (jamais throw)
   */
  async sendResults(input: {
    sessionId: string;
    to: string;
    matches: Array<{ title: string; tagline: string; scorePercent: number }>;
  }): Promise<boolean> {
    if (!this.resend) {
      await this.logEmail({
        sessionId: input.sessionId,
        to: input.to,
        type: 'results',
        status: 'failed',
        error: 'Resend non configuré (RESEND_API_KEY absente).',
      });
      return false;
    }

    const top3 = input.matches.slice(0, 3);
    if (top3.length === 0) {
      this.logger.warn(
        `sendResults: aucun match à envoyer pour la session ${input.sessionId}.`,
      );
      return false;
    }

    // Le sessionId dans l'URL permet à l'utilisateur de retrouver ses résultats
    // même après fermeture du navigateur (restauration depuis la DB via l'email).
    const resultsUrl = `${this.frontendUrl.replace(/\/$/, '')}/resultats?sessionId=${input.sessionId}`;

    const { subject, html, text } = buildResultsEmail({
      topMatches: top3,
      totalMatches: input.matches.length,
      resultsUrl,
    });

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.from,
        to: input.to,
        subject,
        html,
        text,
      });

      if (error) {
        // Resend retourne l'erreur dans le payload plutôt que via throw
        this.logger.warn(
          `Resend a refusé l'envoi à ${input.to} : ${error.message}`,
        );
        await this.logEmail({
          sessionId: input.sessionId,
          to: input.to,
          type: 'results',
          status: 'failed',
          error: error.message,
        });
        return false;
      }

      this.logger.log(
        `Email résultats envoyé à ${input.to} (Resend ID: ${data?.id ?? 'unknown'})`,
      );
      await this.logEmail({
        sessionId: input.sessionId,
        to: input.to,
        type: 'results',
        status: 'sent',
        providerId: data?.id ?? null,
      });
      return true;
    } catch (err) {
      // Erreur réseau, timeout, exception SDK
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Échec inattendu de l'envoi email à ${input.to} : ${message}`,
      );
      await this.logEmail({
        sessionId: input.sessionId,
        to: input.to,
        type: 'results',
        status: 'failed',
        error: message,
      });
      return false;
    }
  }

  /**
   * Envoie l'email de confirmation de paiement après un checkout Stripe.
   *
   * Idempotent : avant d'envoyer, vérifie qu'aucune confirmation n'a déjà été
   * envoyée pour cette session questionnaire (évite les doubles envois si
   * l'utilisateur recharge la page de retour Stripe).
   *
   * @returns true si envoyé, false si déjà envoyé / erreur / désactivé
   */
  async sendPaymentConfirmation(input: {
    sessionId: string;
    to: string;
    amountTotalCents: number;
    currency: string;
    totalMatches: number;
  }): Promise<boolean> {
    if (!this.resend) {
      await this.logEmail({
        sessionId: input.sessionId,
        to: input.to,
        type: 'payment_confirmation',
        status: 'failed',
        error: 'Resend non configuré (RESEND_API_KEY absente).',
      });
      return false;
    }

    // Déduplication : si on a déjà envoyé une confirmation pour cette session,
    // on ne renvoie pas. La verifyPaidSession peut être appelée plusieurs fois
    // (rechargement page après redirection Stripe).
    const alreadySent = await this.prisma.emailLog.findFirst({
      where: {
        sessionId: input.sessionId,
        type: 'payment_confirmation',
        status: 'sent',
      },
    });
    if (alreadySent) {
      this.logger.log(
        `Confirmation paiement déjà envoyée pour session ${input.sessionId} — skip.`,
      );
      return false;
    }

    const paymentResultsUrl = `${this.frontendUrl.replace(/\/$/, '')}/resultats?sessionId=${input.sessionId}`;

    const { subject, html, text } = buildPaymentEmail({
      resultsUrl: paymentResultsUrl,
      amountTotalCents: input.amountTotalCents,
      currency: input.currency,
      totalMatches: input.totalMatches,
    });

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.from,
        to: input.to,
        subject,
        html,
        text,
      });

      if (error) {
        this.logger.warn(
          `Resend a refusé la confirmation paiement à ${input.to} : ${error.message}`,
        );
        await this.logEmail({
          sessionId: input.sessionId,
          to: input.to,
          type: 'payment_confirmation',
          status: 'failed',
          error: error.message,
        });
        return false;
      }

      this.logger.log(
        `Email confirmation paiement envoyé à ${input.to} (Resend ID: ${data?.id ?? 'unknown'})`,
      );
      await this.logEmail({
        sessionId: input.sessionId,
        to: input.to,
        type: 'payment_confirmation',
        status: 'sent',
        providerId: data?.id ?? null,
      });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Échec inattendu confirmation paiement à ${input.to} : ${message}`,
      );
      await this.logEmail({
        sessionId: input.sessionId,
        to: input.to,
        type: 'payment_confirmation',
        status: 'failed',
        error: message,
      });
      return false;
    }
  }

  /**
   * Helper privé : enregistre une trace d'envoi en DB.
   * Volontairement défensif : si l'écriture DB échoue, on ne propage pas
   * l'erreur (le log fichier suffit pour ne pas perdre l'info).
   */
  private async logEmail(input: {
    sessionId?: string;
    to: string;
    type: string;
    status: 'sent' | 'failed';
    providerId?: string | null;
    error?: string;
  }): Promise<void> {
    try {
      await this.prisma.emailLog.create({
        data: {
          sessionId: input.sessionId ?? null,
          to: input.to,
          type: input.type,
          status: input.status,
          providerId: input.providerId ?? null,
          error: input.error ?? null,
        },
      });
    } catch (err) {
      this.logger.error(
        `Impossible d'enregistrer l'EmailLog : ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
