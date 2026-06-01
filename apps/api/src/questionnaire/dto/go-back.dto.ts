import { IsString, MaxLength } from 'class-validator';

export class GoBackDto {
  @IsString()
  @MaxLength(100)
  questionKey!: string;
}
