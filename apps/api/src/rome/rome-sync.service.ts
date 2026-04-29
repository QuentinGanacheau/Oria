import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  GRAND_DOMAINE_LIBELLES,
  deriveDomaineCode,
  deriveGrandDomaineCode,
} from './rome.constants';
import { RomeApiService } from './rome-api.service';
import type { RomeMetierDetails } from './rome.types';

export type SyncReport = {
  total: number;
  succeeded: number;
  failed: number;
  durationMs: number;
};

/**
 * Orchestre la synchronisation complète du référentiel ROME en base.
 *
 * Stratégie :
 *  1. Récupère la liste de tous les métiers (1 appel)
 *  2. Récupère les détails de chaque métier en SÉQUENTIEL avec throttling
 *  3. Upsert chaque métier en DB (idempotent)
 *
 * Contraintes API France Travail :
 *  - Rate limit : 1 appel / seconde sur ROME-Métiers
 *  - On laisse une marge à 1100ms pour absorber les variations réseau
 *  - Retry automatique avec délai sur les 429 ponctuels (rate limit dépassé)
 */
@Injectable()
export class RomeSyncService {
  private readonly logger = new Logger(RomeSyncService.name);

  /** Délai entre deux appels API : 1100ms = 1s + 100ms de marge. */
  private static readonly THROTTLE_MS = 1100;

  /** Délai d'attente après un 429 avant de retenter. */
  private static readonly RETRY_DELAY_MS = 5000;

  /** Nombre max de tentatives par métier (incluant la 1ère). */
  private static readonly MAX_RETRIES = 3;

  /** Fréquence des logs de progression (tous les N métiers). */
  private static readonly PROGRESS_INTERVAL = 50;

  constructor(
    private readonly api: RomeApiService,
    private readonly prisma: PrismaService,
  ) {}

  async syncAll(): Promise<SyncReport> {
    const startedAt = Date.now();
    this.logger.log('Démarrage de la synchronisation ROME…');

    const list = await this.api.listMetiers();
    const estimatedMinutes = Math.ceil(
      (list.length * RomeSyncService.THROTTLE_MS) / 60_000,
    );
    this.logger.log(
      `${list.length} métiers à synchroniser (~${estimatedMinutes} min estimées avec throttling à 1 req/s).`,
    );

    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < list.length; i++) {
      const code = list[i].code;
      try {
        await this.syncOneWithRetry(code);
        succeeded++;
      } catch (error) {
        failed++;
        this.logger.warn(
          `Échec définitif sur ${code} : ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // Throttle entre les appels — sauf après le dernier
      if (i < list.length - 1) {
        await this.sleep(RomeSyncService.THROTTLE_MS);
      }

      // Logs de progression espacés
      const processed = i + 1;
      if (
        processed % RomeSyncService.PROGRESS_INTERVAL === 0 ||
        processed === list.length
      ) {
        const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
        this.logger.log(
          `Progression : ${processed} / ${list.length} — ${elapsedSec}s écoulées (OK: ${succeeded}, KO: ${failed})`,
        );
      }
    }

    const durationMs = Date.now() - startedAt;
    const report: SyncReport = {
      total: list.length,
      succeeded,
      failed,
      durationMs,
    };
    this.logger.log(
      `Sync terminée en ${(durationMs / 1000 / 60).toFixed(1)} min — OK : ${succeeded}, KO : ${failed}.`,
    );
    return report;
  }

  /**
   * Tente la sync d'un métier avec retry exponentiel sur 429 (rate limit).
   * Les autres erreurs (404, 500…) ne sont pas retentées.
   */
  private async syncOneWithRetry(code: string): Promise<void> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= RomeSyncService.MAX_RETRIES; attempt++) {
      try {
        await this.syncOne(code);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const is429 = lastError.message.includes('429');

        if (!is429 || attempt === RomeSyncService.MAX_RETRIES) {
          throw lastError;
        }

        this.logger.warn(
          `Rate limit (429) sur ${code} — retry ${attempt}/${RomeSyncService.MAX_RETRIES - 1} dans ${RomeSyncService.RETRY_DELAY_MS}ms.`,
        );
        await this.sleep(RomeSyncService.RETRY_DELAY_MS);
      }
    }

    // Garde-fou — théoriquement inatteignable
    throw lastError ?? new Error('Échec inattendu sans erreur capturée');
  }

  /** Récupère et upsert un métier individuel. Lance une exception en cas d'échec. */
  private async syncOne(code: string): Promise<void> {
    const details = await this.api.getMetierDetails(code);
    const data = this.toPrismaData(details);

    await this.prisma.romeJob.upsert({
      where: { code: data.code },
      create: data,
      update: data,
    });
  }

  /**
   * Convertit la réponse API en données Prisma.
   *
   * Mapping :
   *  - Domaines : extraits de `domaineProfessionnel` (imbriqué) avec fallback
   *    sur la dérivation depuis le code (toujours fiable).
   *  - Savoir-faire : `competencesMobiliseesPrincipales` (les ~10 actions clés).
   *  - Savoirs : items de type SAVOIR dans `competencesMobilisees` (full set).
   *  - Accès emploi : texte libre direct de l'API.
   */
  private toPrismaData(d: RomeMetierDetails): Prisma.RomeJobCreateInput {
    // Hiérarchie domaine (imbriquée dans la réponse) — fallback sur dérivation.
    const grandDomaineApi = d.domaineProfessionnel?.grandDomaine;
    const codeGrandDomaine =
      grandDomaineApi?.code ?? deriveGrandDomaineCode(d.code);
    const libelleGrandDomaine =
      grandDomaineApi?.libelle ??
      (codeGrandDomaine ? GRAND_DOMAINE_LIBELLES[codeGrandDomaine] : null) ??
      null;
    const codeDomaine = d.domaineProfessionnel?.code ?? deriveDomaineCode(d.code);
    const libelleDomaine = d.domaineProfessionnel?.libelle ?? null;

    // Savoir-faire = compétences principales (déjà filtrées par l'API : ~10 items).
    const savoirFaire = d.competencesMobiliseesPrincipales ?? [];

    // Savoirs = items typés "SAVOIR" dans la liste complète.
    const savoirs = (d.competencesMobilisees ?? []).filter(
      (c) => c.type === 'SAVOIR',
    );

    return {
      code: d.code,
      libelle: d.libelle,
      definition: d.definition ?? null,
      accesEmploi: d.accesEmploi ?? null,
      codeGrandDomaine,
      libelleGrandDomaine,
      codeDomaine,
      libelleDomaine,
      competencesSavoirs:
        savoirs.length > 0
          ? (savoirs as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      competencesSavoirFaire:
        savoirFaire.length > 0
          ? (savoirFaire as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      contextesTravail:
        d.contextesTravail && d.contextesTravail.length > 0
          ? (d.contextesTravail as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      syncedAt: new Date(),
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
