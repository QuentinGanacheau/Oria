import { IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateFeedbackDto {
  @IsOptional()
  @IsString()
  @MaxLength(191)
  sessionId?: string;

  @IsIn(['result_viewed', 'job_clicked', 'rating_submitted', 'conversion'])
  eventType!: 'result_viewed' | 'job_clicked' | 'rating_submitted' | 'conversion';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  selectedJob?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
