import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { SentryModule, SentryGlobalFilter } from '@sentry/nestjs/setup';
import { AppController } from './app.controller';
import { EmailModule } from './email/email.module';
import { FeedbackModule } from './feedback/feedback.module';
import { JobsModule } from './jobs/jobs.module';
import { MatchingModule } from './matching/matching.module';
import { PrismaModule } from './prisma/prisma.module';
import { QuestionnaireModule } from './questionnaire/questionnaire.module';
import { BillingModule } from './billing/billing.module';

@Module({
  imports: [
    // SentryModule doit être enregistré en premier (recommandation Sentry).
    SentryModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    JobsModule,
    QuestionnaireModule,
    BillingModule,
    FeedbackModule,
    MatchingModule,
    EmailModule,
  ],
  controllers: [AppController],
  providers: [
    // Capture les exceptions HTTP non gérées et les remonte à Sentry avant
    // de laisser NestJS poursuivre son traitement d'erreur habituel.
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,
    },
  ],
})
export class AppModule {}
