import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DomainScorerService } from './domain-scorer.service';
import { JobRankerService } from './job-ranker.service';
import { MatchingService } from './matching.service';

/**
 * Module dédié au pipeline de matching ROME (Phase 2).
 * Exporte MatchingService pour utilisation par QuestionnaireService.
 */
@Module({
  imports: [PrismaModule, AiModule],
  providers: [DomainScorerService, JobRankerService, MatchingService],
  exports: [MatchingService],
})
export class MatchingModule {}
