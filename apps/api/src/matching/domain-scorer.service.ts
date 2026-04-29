import { Injectable } from '@nestjs/common';
import type { DomainCode, MatchingAnswer } from './matching.types';

/**
 * Calcule le score de chaque grand domaine ROME à partir des réponses.
 *
 * Logique pure (aucune dépendance externe), facile à tester. Reproduit le
 * pattern de l'ancien `computeBaseScores` mais à l'échelle des 14 grands
 * domaines au lieu des slugs métier individuels.
 */
@Injectable()
export class DomainScorerService {
  /**
   * Additionne les poids des domaines pour chaque réponse.
   * Une réponse sans `domainWeights` (ex: texte libre non traité) est ignorée.
   */
  compute(answers: MatchingAnswer[]): Record<DomainCode, number> {
    const totals: Record<DomainCode, number> = {};

    for (const answer of answers) {
      if (!answer.domainWeights) continue;

      for (const [code, weight] of Object.entries(answer.domainWeights)) {
        if (typeof weight !== 'number' || Number.isNaN(weight)) continue;
        totals[code] = (totals[code] ?? 0) + weight;
      }
    }

    return totals;
  }

  /**
   * Sélectionne les N meilleurs grands domaines.
   * Retourne uniquement ceux avec un score strictement positif —
   * inutile de remonter des candidats sur un domaine non sollicité.
   */
  topDomains(
    scores: Record<DomainCode, number>,
    count: number,
  ): DomainCode[] {
    return Object.entries(scores)
      .filter(([, score]) => score > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, count)
      .map(([code]) => code);
  }
}
