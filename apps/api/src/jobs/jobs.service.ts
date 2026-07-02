import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RomeJob } from '@prisma/client';
import {
  AiService,
  type PersonalizedSheetContent,
  type PersonalizedSheetInput,
} from '../ai/ai.service';
import { deriveUserContext } from '../ai/user-context';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Représentation d'un métier exposée à l'app et au frontend.
 *
 * Forme stable : si demain on change de référentiel (ROME → autre source),
 * on adapte uniquement la conversion interne (méthode `toJobProfile`).
 * Le reste du code (et le frontend) ne bouge pas.
 */
export type JobProfile = {
  /** Code ROME du métier (ex : M1805, J1502). Utilisé comme identifiant URL. */
  slug: string;
  title: string;
  tagline: string;
  summary: string;
  missions: string[];
  skills: string[];
  formations: string[];
  salaryRangeHint: string;
  workContext: string;
  /**
   * Niveau de recrutement relatif (comparé aux autres métiers), dérivé du
   * volume d'offres en ligne France Travail. Null si la donnée est indisponible
   * (API Offres non configurée ou pas encore synchronisée) — le front masque alors le badge.
   */
  recruitmentLevel: 'high' | 'medium' | 'low' | null;
  /** Nombre d'offres actives relevé à la dernière sync. Null si indisponible. */
  offerCount: number | null;
};

/**
 * Forme (partielle) d'une entrée de `RefinedBatch.matches` — le JSON figé des
 * paquets affinés du swipe deck. On ne type que les champs lus ici : le slug
 * du métier et le cache de fiche personnalisée (ajouté à la volée à la 1ʳᵉ visite).
 */
type RefinedBatchMatch = {
  job?: { slug?: string };
  personalizedContent?: PersonalizedSheetContent;
};

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  async findAll(): Promise<JobProfile[]> {
    const jobs = await this.prisma.romeJob.findMany({
      orderBy: { libelle: 'asc' },
    });
    return jobs.map((j) => this.toJobProfile(j));
  }

  async findBySlug(code: string): Promise<JobProfile> {
    const job = await this.prisma.romeJob.findUnique({ where: { code } });
    if (!job) {
      throw new NotFoundException(`Métier introuvable : ${code}`);
    }
    return this.toJobProfile(job);
  }

  /**
   * Retourne la fiche personnalisée pour un couple (session, métier).
   *
   * Deux sources de métiers, chacune son propre cache-aside :
   *  - Passe 1 (top gratuit) → MatchResult.personalizedContent
   *  - Passe 2 (paquets affinés du swipe deck, payant) → RefinedBatch.matches[].personalizedContent
   *
   * Dans les deux cas :
   *  - Cache hit  → retour immédiat (0 appel IA)
   *  - Cache miss → génération IA → stockage → retour
   *  - IA indisponible → null (dégradation propre, le front affiche la fiche statique)
   *
   * Si le métier n'appartient à aucune des deux sources pour cette session
   * → null (session inconnue ou métier non servi à cet utilisateur).
   */
  async getPersonalizedSheet(
    code: string,
    sessionId: string,
  ): Promise<PersonalizedSheetContent | null> {
    // Vérifie l'existence du métier (lève NotFoundException si inconnu)
    const job = await this.findBySlug(code);

    const matchResult = await this.prisma.matchResult.findFirst({
      where: { sessionId, jobSlug: code },
    });

    // Passe 1 : métier du top gratuit, caché sur MatchResult.
    if (matchResult) {
      if (matchResult.personalizedContent !== null) {
        return matchResult.personalizedContent as PersonalizedSheetContent;
      }

      const content = await this.generateSheet(
        job,
        sessionId,
        matchResult.rank,
      );
      if (content) {
        await this.prisma.matchResult.update({
          where: { id: matchResult.id },
          data: {
            personalizedContent: content as unknown as Prisma.InputJsonValue,
          },
        });
      }
      return content;
    }

    // Passe 2 : métier issu d'un paquet affiné (swipe deck). Ces métiers ne sont
    // jamais dans MatchResult — leur cache vit dans le JSON du RefinedBatch.
    return this.getRefinedBatchSheet(job, sessionId, code);
  }

  /**
   * Fiche personnalisée d'un métier de paquet affiné (passe 2).
   *
   * Le cache est stocké directement dans le JSON `RefinedBatch.matches`, sur
   * l'entrée du métier concerné — plutôt que de créer un MatchResult, ce qui
   * polluerait la séparation passe 1 / passe 2 (restauration, exclusions).
   */
  private async getRefinedBatchSheet(
    job: JobProfile,
    sessionId: string,
    code: string,
  ): Promise<PersonalizedSheetContent | null> {
    const batches = await this.prisma.refinedBatch.findMany({
      where: { sessionId },
      orderBy: { batchNumber: 'asc' },
    });

    // Rang global approximatif : nb de métiers servis avant celui-ci (passe 1 +
    // paquets précédents). Sert uniquement à teinter le ton du prompt IA.
    const passe1Count = await this.prisma.matchResult.count({
      where: { sessionId },
    });
    let precedingCount = passe1Count;

    for (const batch of batches) {
      const matches = (batch.matches as unknown as RefinedBatchMatch[]) ?? [];
      const index = matches.findIndex((m) => m?.job?.slug === code);
      if (index === -1) {
        precedingCount += matches.length;
        continue;
      }

      const target = matches[index];

      // Cache hit
      if (target.personalizedContent) {
        return target.personalizedContent;
      }

      const content = await this.generateSheet(
        job,
        sessionId,
        precedingCount + index + 1,
      );

      // Mise en cache dans le JSON du batch uniquement si la génération a réussi.
      if (content) {
        matches[index] = { ...target, personalizedContent: content };
        await this.prisma.refinedBatch.update({
          where: { id: batch.id },
          data: { matches: matches as unknown as Prisma.InputJsonValue },
        });
      }
      return content;
    }

    // Métier absent des deux passes : pas servi à cette session.
    return null;
  }

  /**
   * Prépare l'input IA depuis les réponses de la session et génère la fiche.
   * Partagé entre la passe 1 (MatchResult) et la passe 2 (RefinedBatch).
   * Retourne null si la session n'a pas de réponses ou si l'IA est indisponible.
   */
  private async generateSheet(
    job: JobProfile,
    sessionId: string,
    rank: number,
  ): Promise<PersonalizedSheetContent | null> {
    const answers = await this.prisma.sessionAnswer.findMany({
      where: { sessionId },
      include: { question: true, option: true },
    });
    if (answers.length === 0) return null;

    const situationAnswer = answers.find((a) => a.question.key === 'situation');
    const situation = situationAnswer?.option?.key ?? 'actif';
    const userContext = deriveUserContext(situation);

    const formattedAnswers = answers.map((a) => ({
      question: a.question.text,
      answer: a.option?.label ?? a.freeText ?? '',
    }));

    const input: PersonalizedSheetInput = {
      job: {
        title: job.title,
        summary: job.summary,
        missions: job.missions,
        skills: job.skills,
      },
      answers: formattedAnswers,
      rank,
      situation,
      userContext,
    };

    return this.ai.generatePersonalizedSheet(input);
  }

  // ─── Adaptation ROME → JobProfile ─────────────────────────────────────────

  /**
   * Adapte un RomeJob (forme officielle France Travail) en JobProfile
   * (forme exposée à l'app). Centralise la conversion pour isoler les
   * changements éventuels du référentiel ROME du reste du code.
   */
  private toJobProfile(j: RomeJob): JobProfile {
    const accesEmploi = this.normalizeText(j.accesEmploi);
    return {
      slug: j.code,
      title: j.libelle,
      tagline: j.libelleDomaine ?? j.libelleGrandDomaine ?? '',
      summary: this.normalizeText(j.definition),
      missions: this.extractCompetenceLabels(j.competencesSavoirFaire),
      skills: this.extractCompetenceLabels(j.competencesSavoirs),
      // ROME ne fournit pas de liste de formations structurée mais propose
      // un texte libre `accesEmploi` qui décrit le niveau requis. On
      // l'expose comme un seul item dans `formations` pour rester compatible
      // avec le contrat existant côté frontend.
      formations: accesEmploi ? [accesEmploi] : [],
      // ROME ne fournit pas d'info de rémunération.
      salaryRangeHint: '',
      workContext: this.extractContextLabels(j.contextesTravail),
      recruitmentLevel: this.normalizeRecruitmentLevel(j.recruitmentLevel),
      offerCount: j.offerCount,
    };
  }

  /**
   * Restreint la valeur stockée (String libre en DB) aux trois paliers attendus.
   * Toute autre valeur (ou null) est traitée comme « pas de donnée ».
   */
  private normalizeRecruitmentLevel(
    raw: string | null,
  ): 'high' | 'medium' | 'low' | null {
    return raw === 'high' || raw === 'medium' || raw === 'low' ? raw : null;
  }

  /**
   * Normalise un texte ROME pour l'affichage.
   *
   * L'API France Travail renvoie parfois des séquences `\n` littérales
   * (backslash + "n") au lieu de vrais sauts de ligne. On les convertit
   * en vrais retours pour que le frontend (avec `whitespace-pre-line`)
   * les rende correctement.
   */
  private normalizeText(raw: string | null | undefined): string {
    if (!raw) return '';
    return raw
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, ' ')
      .trim();
  }

  /**
   * Extrait les libellés de compétences depuis le JSON brut ROME.
   * Limité à 10 entrées pour éviter de surcharger les fiches métier.
   */
  private extractCompetenceLabels(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((c) => this.readLibelle(c))
      .filter((s): s is string => s !== null)
      .slice(0, 10);
  }

  /** Joint les contextes de travail en une chaîne lisible (séparateur " · "). */
  private extractContextLabels(raw: unknown): string {
    if (!Array.isArray(raw) || raw.length === 0) return '';
    return raw
      .map((c) => this.readLibelle(c))
      .filter((s): s is string => s !== null)
      .slice(0, 5)
      .join(' · ');
  }

  /**
   * Lit le champ "libelle" d'un objet ROME en tolérant les variantes
   * de casing rencontrées dans l'API (libelle / libellé / label).
   */
  private readLibelle(item: unknown): string | null {
    if (!item || typeof item !== 'object') return null;
    const obj = item as Record<string, unknown>;
    const value = obj.libelle ?? obj['libellé'] ?? obj.label;
    return typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : null;
  }
}
