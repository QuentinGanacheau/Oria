import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCheckoutDto {
  @IsOptional()
  @IsString()
  @MaxLength(512)
  /** Chemin relatif (ex. /resultats) — concaténé à FRONTEND_URL */
  successPath?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  cancelPath?: string;

  /**
   * ID de la session questionnaire en cours (cuid).
   * Stocké dans `metadata.questionnaireSessionId` côté Stripe pour pouvoir
   * retrouver l'email et envoyer la confirmation après paiement.
   * Optionnel : si absent, on ne peut pas associer le paiement à une session.
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sessionId?: string;
}
