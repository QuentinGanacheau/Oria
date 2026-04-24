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
}
