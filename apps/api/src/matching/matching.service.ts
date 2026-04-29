import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DomainScorerService } from './domain-scorer.service';
import { JobRankerService } from './job-ranker.service';
import type {
  JobCandidate,
  MatchedJob,
  MatchingAnswer,
  MatchingOptions,
} from './matching.types';

/**
 * Orchestrateur du pipeline de matching ROME.
 *
 * Pipeline en 3 étapes :
 *   1. Score les grands domaines à partir des réponses
 *   2. Récupère les métiers candidats des top N domaines
 *   3. Reranke ces candidats avec l'IA
 *
 * Volontairement séparé du QuestionnaireService — il sera appelé par lui en
 * étape suivante, mais reste utilisable indépendamment (tests, scripts CLI…).
 */
@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  /** Valeurs par défaut pour les options du pipeline. */
  private static readonly DEFAULTS: Required<MatchingOptions> = {
    topDomainsCount: 3,
    finalTopN: 10,
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly domainScorer: DomainScorerService,
    private readonly jobRanker: JobRankerService,
  ) {}

  async findBestJobs(
    answers: MatchingAnswer[],
    options: MatchingOptions = {},
  ): Promise<MatchedJob[]> {
    const opts = { ...MatchingService.DEFAULTS, ...options };

    // 1. Score par grand domaine + sélection des N meilleurs
    const domainScores = this.domainScorer.compute(answers);
    const topDomains = this.domainScorer.topDomains(
      domainScores,
      opts.topDomainsCount,
    );

    if (topDomains.length === 0) {
      this.logger.warn(
        'Aucun grand domaine identifié — réponses sans poids domain ?',
      );
      return [];
    }

    this.logger.log(
      `Top ${topDomains.length} grands domaines : ${topDomains.join(', ')}`,
    );

    // 2. Métiers candidats issus des top domaines
    const candidates = await this.fetchCandidates(topDomains);

    if (candidates.length === 0) {
      this.logger.warn(
        `Aucun métier ROME trouvé pour les domaines [${topDomains.join(', ')}]. La sync ROME est-elle terminée ?`,
      );
      return [];
    }

    this.logger.log(`${candidates.length} métiers candidats à reranker.`);

    // 3. Reranking IA + slice final
    const ranked = await this.jobRanker.rank(candidates, answers);
    return ranked.slice(0, opts.finalTopN);
  }

  /**
   * Récupère les métiers ROME associés aux grands domaines retenus.
   * Sélectionne uniquement les colonnes nécessaires au reranking pour limiter
   * le poids du payload IA et la mémoire.
   */
  private async fetchCandidates(
    domainCodes: string[],
  ): Promise<JobCandidate[]> {
    const rows = await this.prisma.romeJob.findMany({
      where: { codeGrandDomaine: { in: domainCodes } },
      select: {
        code: true,
        libelle: true,
        codeGrandDomaine: true,
      },
    });

    return rows.map((row) => ({
      code: row.code,
      libelle: row.libelle,
      codeGrandDomaine: row.codeGrandDomaine,
    }));
  }
}
