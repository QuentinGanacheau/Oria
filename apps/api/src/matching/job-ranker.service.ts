import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import type { JobCandidate, MatchedJob, MatchingAnswer } from './matching.types';

/**
 * Reranke une liste de métiers candidats avec l'IA, en se basant sur les
 * réponses de l'utilisateur au questionnaire.
 *
 * Si l'IA est indisponible ou échoue, retourne les candidats dans l'ordre
 * d'entrée avec un score uniforme — l'utilisateur voit toujours un résultat
 * (dégradation propre).
 */
@Injectable()
export class JobRankerService {
  private readonly logger = new Logger(JobRankerService.name);

  constructor(private readonly ai: AiService) {}

  async rank(
    candidates: JobCandidate[],
    answers: MatchingAnswer[],
  ): Promise<MatchedJob[]> {
    if (candidates.length === 0) return [];

    // Tentative IA (peut retourner null si indisponible / échec)
    const aiScores = await this.ai.rankJobsForProfile({
      candidates: candidates.map((c) => ({
        code: c.code,
        libelle: c.libelle,
      })),
      answers: answers.map((a) => ({
        question: a.question,
        answer: a.answer,
      })),
    });

    if (!aiScores) {
      this.logger.warn(
        'IA indisponible pour le reranking — fallback ordre brut.',
      );
      return this.fallbackRanking(candidates);
    }

    // Construit le résultat trié par score IA décroissant
    const ranked = candidates
      .map((c) => ({
        code: c.code,
        libelle: c.libelle,
        score: aiScores[c.code] ?? 0,
      }))
      .sort((a, b) => b.score - a.score);

    return ranked.map((job, index) => ({
      ...job,
      rank: index + 1,
    }));
  }

  /**
   * Fallback : ordre d'entrée préservé, score uniforme à 50.
   * On évite de mettre 0 (psychologiquement décourageant).
   */
  private fallbackRanking(candidates: JobCandidate[]): MatchedJob[] {
    return candidates.map((c, index) => ({
      code: c.code,
      libelle: c.libelle,
      score: 50,
      rank: index + 1,
    }));
  }
}
