import { IsString, MaxLength } from 'class-validator';

export class FinishSessionDto {
  @IsString()
  @MaxLength(191)
  sessionId!: string;
}
