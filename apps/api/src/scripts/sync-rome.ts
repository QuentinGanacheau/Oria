/**
 * Script CLI : synchronise toutes les fiches métier ROME 4.0 en base.
 *
 * Usage :
 *   npm run sync:rome
 *
 * Prérequis (variables d'environnement dans apps/api/.env) :
 *   FRANCE_TRAVAIL_CLIENT_ID
 *   FRANCE_TRAVAIL_CLIENT_SECRET
 *
 * Câblage manuel (pas de DI Nest) : tsx ne propage pas les métadonnées
 * de décorateurs nécessaires au DI. Pour un script one-shot, l'instanciation
 * directe est plus simple, plus rapide à démarrer, et explicite — on voit
 * exactement quels services sont en jeu et dans quel ordre. Les services
 * eux-mêmes restent décorés `@Injectable()` et utilisables en DI Nest dans
 * l'app principale (Phase 2).
 */
import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { config as loadDotenv } from 'dotenv';
import { PrismaService } from '../prisma/prisma.service';
import { RomeApiService } from '../rome/rome-api.service';
import { RomeAuthService } from '../rome/rome-auth.service';
import { RomeConfig } from '../rome/rome.config';
import { RomeSyncService } from '../rome/rome-sync.service';

// Charge les variables depuis apps/api/.env (idem au comportement de l'app Nest).
loadDotenv();

async function main(): Promise<void> {
  const prisma = new PrismaService();
  await prisma.$connect();

  // Câblage manuel : chaque service reçoit ses dépendances explicitement.
  const configService = new ConfigService();
  const romeConfig = new RomeConfig(configService);
  const auth = new RomeAuthService(romeConfig);
  const api = new RomeApiService(auth, romeConfig);
  const sync = new RomeSyncService(api, prisma);

  try {
    const report = await sync.syncAll();
    console.log('\n✓ Synchronisation terminée');
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error(
      '\n✗ Échec de la synchronisation :',
      error instanceof Error ? error.message : String(error),
    );
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
