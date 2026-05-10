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

  /**
   * Nombre max de candidats récupérés par grand domaine.
   * Limite la taille du prompt IA : 100+ candidats → prompt énorme → 503.
   * 25 par domaine × 3 domaines max = 75 candidats, bien dans les limites.
   */
  private static readonly MAX_CANDIDATES_PER_DOMAIN = 25;

  constructor(
    private readonly prisma: PrismaService,
    private readonly domainScorer: DomainScorerService,
    private readonly jobRanker: JobRankerService,
  ) {}

  /**
   * Retourne null si l'IA est totalement indisponible (tous providers en échec).
   * L'appelant doit traiter ce cas comme une erreur de service (503).
   */
  async findBestJobs(
    answers: MatchingAnswer[],
    options: MatchingOptions = {},
  ): Promise<MatchedJob[] | null> {
    const opts = { ...MatchingService.DEFAULTS, ...options };

    // 1. Score par grand domaine + sélection des N meilleurs (avec seuil relatif)
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
      `Top domaines retenus : ${topDomains.join(', ')} (scores : ${topDomains.map((d) => `${d}=${domainScores[d] ?? 0}`).join(', ')})`,
    );

    // 2. Métiers candidats issus des top domaines (capés par domaine)
    const candidates = await this.fetchCandidates(topDomains, domainScores);

    if (candidates.length === 0) {
      this.logger.warn(
        `Aucun métier ROME trouvé pour les domaines [${topDomains.join(', ')}]. La sync ROME est-elle terminée ?`,
      );
      return [];
    }

    this.logger.log(`${candidates.length} métiers candidats à reranker.`);

    // 3. Reranking IA — null si IA totalement indisponible
    const ranked = await this.jobRanker.rank(candidates, answers);
    if (ranked === null) {
      // Pas de fallback : sans IA, le domaine seul donne des résultats trop
      // hétérogènes pour être présentés à l'utilisateur. L'appelant affichera
      // un message d'erreur clair.
      return null;
    }
    return ranked.slice(0, opts.finalTopN);
  }

  /**
   * Récupère les métiers ROME associés aux domaines retenus.
   *
   * Supporte deux niveaux de granularité ROME :
   *   - Code 1 char  (ex: "M") → filtre sur `codeGrandDomaine` (~200 métiers)
   *   - Code 3 chars (ex: "M18") → filtre sur `codeDomaine` (~20 métiers)
   *
   * Déduplication parent/enfant : si "M18" ET "M" sont tous les deux retenus,
   * on ignore "M" pour éviter de doubler les métiers de M18 déjà présents.
   *
   * Cap par domaine : MAX_CANDIDATES_PER_DOMAIN avec mélange aléatoire
   * (Fisher-Yates) pour varier les résultats entre sessions.
   */
  private async fetchCandidates(
    domainCodes: string[],
    domainScores: Record<string, number>,
  ): Promise<JobCandidate[]> {
    const cap = MatchingService.MAX_CANDIDATES_PER_DOMAIN;

    // Déduplication : retirer un code grand-domaine (1 char) si un sous-domaine
    // (3 chars) de la même lettre est déjà dans la liste.
    // Ex : ["M", "M18"] → garder seulement "M18" (plus précis).
    const subDomainParents = new Set(
      domainCodes
        .filter((c) => c.length === 3)
        .map((c) => c[0]),
    );
    const deduped = domainCodes.filter(
      (c) => !(c.length === 1 && subDomainParents.has(c)),
    );

    if (deduped.length < domainCodes.length) {
      this.logger.log(
        `Déduplication domaines : ${domainCodes.join(', ')} → ${deduped.join(', ')}`,
      );
    }

    const allCandidates: JobCandidate[] = [];

    for (const domainCode of deduped) {
      const isSubDomain = domainCode.length === 3;

      // SQLite ne supporte pas ORDER BY RANDOM() via Prisma — on prend
      // tous les métiers du domaine puis on échantillonne côté Node.
      const rows = await this.prisma.romeJob.findMany({
        where: isSubDomain
          ? { codeDomaine: domainCode }
          : { codeGrandDomaine: domainCode },
        select: { code: true, libelle: true, codeGrandDomaine: true },
      });

      // Mélange Fisher-Yates puis troncature au cap
      const shuffled = rows
        .map((r) => ({ r, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map(({ r }) => r)
        .slice(0, cap);

      allCandidates.push(
        ...shuffled.map((row) => ({
          code: row.code,
          libelle: row.libelle,
          codeGrandDomaine: row.codeGrandDomaine,
        })),
      );

      this.logger.log(
        `Domaine ${domainCode} (${isSubDomain ? 'sous-domaine' : 'grand domaine'}, score=${domainScores[domainCode] ?? 0}) : ${shuffled.length}/${rows.length} métiers retenus.`,
      );
    }

    return allCandidates;
  }
}
