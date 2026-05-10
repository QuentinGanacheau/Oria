import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Body du POST /v1/email/capture.
 *
 * Capture l'email entre la fin du questionnaire et l'affichage des résultats.
 * Le consentement explicite est obligatoire (RGPD).
 */
export class CaptureEmailDto {
  /** ID de la session questionnaire courante (cuid). */
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  sessionId!: string;

  /** Email de l'utilisateur — validé strictement. */
  @IsEmail({}, { message: 'Email invalide.' })
  @MaxLength(320) // RFC 3696 — max théorique d'un email
  email!: string;

  /**
   * Consentement explicite RGPD à recevoir les emails liés à la session
   * (résultats, relances, confirmation de paiement).
   * Doit être true — sinon la requête est rejetée côté service.
   */
  @IsBoolean()
  consent!: boolean;
}
