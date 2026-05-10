import {
  BadRequestException,
  Body,
  Controller,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CaptureEmailDto } from './dto/capture-email.dto';
import { EmailService } from './email.service';

@Controller('email')
export class EmailController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  /**
   * POST /v1/email/capture
   *
   * Capture l'email de l'utilisateur (entre la fin du questionnaire et l'affichage
   * des résultats), enregistre le consentement RGPD, et déclenche l'envoi de
   * l'email de résultats.
   *
   * Idempotent : si la session a déjà un email, on le met à jour (au cas où
   * l'utilisateur corrige une faute de frappe).
   *
   * Réponse :
   *   { ok: true, emailSent: boolean }
   *   - ok = true → l'email a bien été enregistré sur la session
   *   - emailSent = true → l'email de résultats est parti côté Resend
   *                false → enregistré en base mais envoi échoué
   *                        (Resend HS, etc.) → support possible plus tard
   */
  @Post('capture')
  async capture(@Body() dto: CaptureEmailDto) {
    if (!dto.consent) {
      throw new BadRequestException(
        "Le consentement à recevoir les emails est obligatoire.",
      );
    }

    // Vérifie l'existence de la session — évite d'enregistrer un email orphelin
    const session = await this.prisma.questionnaireSession.findUnique({
      where: { id: dto.sessionId },
      include: {
        matches: {
          orderBy: { rank: 'asc' },
        },
      },
    });
    if (!session) {
      throw new NotFoundException('Session introuvable.');
    }

    // 1. Enregistrer email + consentement sur la session
    await this.prisma.questionnaireSession.update({
      where: { id: dto.sessionId },
      data: {
        email: dto.email.toLowerCase().trim(),
        emailConsent: true,
      },
    });

    // 2. Construire les matches pour l'email à partir des MatchResult déjà
    //    persistés. On a juste besoin du libellé du métier — pas besoin
    //    d'aller chercher la fiche complète pour un email.
    const matchesForEmail = await Promise.all(
      session.matches.map(async (m) => {
        const job = await this.prisma.romeJob.findUnique({
          where: { code: m.jobSlug },
          select: { libelle: true, libelleDomaine: true, libelleGrandDomaine: true },
        });
        return {
          title: job?.libelle ?? m.jobSlug,
          tagline: job?.libelleDomaine ?? job?.libelleGrandDomaine ?? '',
          scorePercent: Math.round(m.score),
        };
      }),
    );

    // 3. Tenter l'envoi (jamais bloquant — on log si ça rate)
    const emailSent = await this.email.sendResults({
      sessionId: dto.sessionId,
      to: dto.email.toLowerCase().trim(),
      matches: matchesForEmail,
    });

    return { ok: true, emailSent };
  }
}
