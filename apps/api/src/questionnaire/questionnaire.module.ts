import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { QuestionnaireController } from './questionnaire.controller';
import { QuestionnaireService } from './questionnaire.service';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [JobsModule, AiModule],
  controllers: [QuestionnaireController],
  providers: [QuestionnaireService],
})
export class QuestionnaireModule {}
