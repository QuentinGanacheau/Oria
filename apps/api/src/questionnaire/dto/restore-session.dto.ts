import { IsEmail, MaxLength } from 'class-validator';

/**
 * Query params du GET /v1/questionnaire/:sessionId/results.
 *
 * L'email sert de vérification anti-partage : le lien contenu dans l'email
 * de résultats ne fonctionne que si l'utilisateur connaît l'email associé
 * à la session. Un tiers qui obtiendrait l'URL ne pourrait pas accéder aux
 * résultats sans connaître cet email.
 */
export class RestoreSessionDto {
  @IsEmail({}, { message: 'Email invalide.' })
  @MaxLength(320)
  email!: string;
}
