import { IsObject, IsOptional } from 'class-validator';

export class StartSessionDto {
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
