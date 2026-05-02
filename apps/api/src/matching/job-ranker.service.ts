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

  /**
   * Reranke les candidats avec l'IA et retourne les résultats triés.
   *
   * Retourne `null` si l'IA est totalement indisponible (quota dépassé,
   * tous les providers en erreur…). L'appelant décide alors quoi faire :
   * afficher une erreur plutôt que des résultats aléatoires sans valeur.
   *
   * Ne produit plus de fallback local : sans IA, le domaine ROME seul
   * n'est pas assez précis pour garantir des résultats pertinents.
   */
  async rank(
    candidates: JobCandidate[],
    answers: MatchingAnswer[],
  ): Promise<MatchedJob[] | null> {
    if (candidates.length === 0) return [];

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
      this.logger.warn('IA indisponible pour le reranking — résultat null.');
      return null;
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
}
