import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/** Valeurs valides pour une note métier. */
export type JobRatingValue = 'like' | 'dislike' | 'neutral';

export class RateJobDto {
  /** Code ROME du métier noté (ex: "M1805"). */
  @IsString()
  @MaxLength(10)
  jobSlug!: string;

  /** Appréciation : "like" | "dislike" | "neutral" */
  @IsIn(['like', 'dislike', 'neutral'])
  rating!: JobRatingValue;

  /**
   * Raison optionnelle du rejet (uniquement pertinent pour "dislike").
   * Peut contenir des chips pré-définies et/ou du texte libre.
   * Ex: "Trop de contact client. Pas assez créatif."
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
