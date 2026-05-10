import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AnswerNextDto {
  @IsString()
  @MaxLength(191)
  sessionId!: string;

  @IsString()
  @MaxLength(191)
  questionKey!: string;

  // Soit une option (QCM), soit un texte libre — validé au niveau service selon le type de question.
  @IsOptional()
  @IsString()
  @MaxLength(191)
  optionKey?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  freeText?: string;
}
