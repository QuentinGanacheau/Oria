import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Corps optionnel de `POST /:sessionId/next-batch`.
 *
 * `probeAnswer` = le label de l'axe choisi par l'utilisateur à la question
 * d'affinage A/B (swipe deck). Absent si l'utilisateur a passé la question ou
 * si aucune question n'a été générée.
 */
export class NextBatchDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  probeAnswer?: string;
}
