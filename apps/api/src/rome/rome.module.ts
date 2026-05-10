import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { RomeApiService } from './rome-api.service';
import { RomeAuthService } from './rome-auth.service';
import { RomeConfig } from './rome.config';
import { RomeSyncService } from './rome-sync.service';

/**
 * Module dédié à l'intégration France Travail (ROME 4.0).
 *
 * Volontairement non importé dans AppModule en Phase 1 : il est uniquement
 * utilisé par le script `sync-rome.ts` qui crée son propre contexte Nest.
 * Dès la Phase 2, on l'importera dans AppModule pour que QuestionnaireService
 * puisse exploiter les données ROME.
 */
@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [RomeConfig, RomeAuthService, RomeApiService, RomeSyncService],
  exports: [RomeSyncService, RomeApiService],
})
export class RomeModule {}
