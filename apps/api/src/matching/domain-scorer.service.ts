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
   * Sélectionne les N meilleurs grands domaines avec seuil relatif,
   * en fusionnant les scores sous-domaine (3 chars) dans leur parent (1 char).
   *
   * ── Problème résolu ───────────────────────────────────────────────────────
   * Sans fusion, M=28 et M18=10 sont en concurrence : M18 passe sous le seuil
   * (10 < 28×0.40=11.2) et le fetch porte sur TOUT M — compta, RH, météo…
   *
   * ── Algorithme ────────────────────────────────────────────────────────────
   * 1. Les scores 3-chars (M18, M11…) s'additionnent dans leur parent 1-char.
   *    → M total = M(28) + M18(10) = 38. Seuil 38×0.40=15.2 → seul M retenu.
   * 2. Pour chaque grand domaine retenu, on regarde si un sous-domaine a un
   *    score ≥ SUB_MIN_SCORE : si oui, on retourne le sous-domaine à la place.
   *    → M retenu + M18(10) ≥ 3 → on émet "M18" (fetch précis ~20 métiers IT)
   *      plutôt que "M" (fetch large ~200 métiers tout confondus).
   *
   * ── Exemple profil tech ───────────────────────────────────────────────────
   *   scores bruts : { M: 28, M18: 10, C: 14, E: 9 }
   *   après fusion : { M: 38, C: 14, E: 9 }
   *   seuil         : 38 × 0.40 = 15.2
   *   retenus       : [M]   (C=14 < 15.2, E=9 exclus)
   *   substitution  : M18(10) ≥ 3 → retourne ["M18"] ← développeurs, data, etc.
   *
   * ── Exemple profil mixte ─────────────────────────────────────────────────
   *   scores bruts : { M: 15, D: 13, K: 10 }
   *   fusion       : identique (pas de sous-domaines)
   *   seuil        : 15 × 0.40 = 6 → tous retenus
   *   substitution : aucun → retourne ["M", "D", "K"]
   */
  topDomains(
    scores: Record<DomainCode, number>,
    count: number,
    minRatio = 0.40,
  ): DomainCode[] {
    // ── Séparer grands domaines (1 char) et sous-domaines (3 chars) ────────
    const grandScores: Record<string, number> = {};
    const subScores: Record<string, number> = {};

    for (const [code, score] of Object.entries(scores)) {
      if (typeof score !== 'number' || score <= 0) continue;
      if (code.length === 1) {
        grandScores[code] = (grandScores[code] ?? 0) + score;
      } else if (code.length === 3) {
        subScores[code] = (subScores[code] ?? 0) + score;
        // Fusion : le sous-domaine renforce son parent
        const parent = code[0];
        grandScores[parent] = (grandScores[parent] ?? 0) + score;
      }
    }

    // ── Sélection des N meilleurs grands domaines (score fusionné) ─────────
    const sorted = Object.entries(grandScores)
      .sort(([, a], [, b]) => b - a);

    if (sorted.length === 0) return [];

    const topScore = sorted[0][1];
    const threshold = topScore * minRatio;

    const topGrand = sorted
      .filter(([, score]) => score >= threshold)
      .slice(0, count)
      .map(([code]) => code);

    // ── Substitution par sous-domaine si signal précis disponible ──────────
    const SUB_MIN_SCORE = 3;

    return topGrand.map((grandCode) => {
      const bestSub = Object.entries(subScores)
        .filter(([sub]) => sub[0] === grandCode)
        .sort(([, a], [, b]) => b - a)[0];

      return bestSub && bestSub[1] >= SUB_MIN_SCORE
        ? bestSub[0]   // sous-domaine précis (ex: "M18")
        : grandCode;   // grand domaine générique (ex: "M")
    });
  }
}
