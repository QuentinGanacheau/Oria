import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RomeJob } from '@prisma/client';
import {
  AiService,
  type PersonalizedSheetContent,
  type PersonalizedSheetInput,
} from '../ai/ai.service';
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
   * Pattern cache-aside :
   *  - Cache hit  → retour immédiat depuis MatchResult.personalizedContent (0 appel IA)
   *  - Cache miss → génération IA → stockage → retour
   *  - IA indisponible → null (dégradation propre, le front affiche la fiche statique)
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

    // Pas de match = session inconnue ou métier non classé pour cette session
    if (!matchResult) return null;

    // Cache hit
    if (matchResult.personalizedContent !== null) {
      return matchResult.personalizedContent as PersonalizedSheetContent;
    }

    // Cache miss → préparation de l'input IA
    const answers = await this.prisma.sessionAnswer.findMany({
      where: { sessionId },
      include: { question: true, option: true },
    });
    if (answers.length === 0) return null;

    const situationAnswer = answers.find((a) => a.question.key === 'situation');
    const situation = situationAnswer?.option?.key ?? 'actif';

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
      rank: matchResult.rank,
      situation,
    };

    const content = await this.ai.generatePersonalizedSheet(input);

    // Mise en cache uniquement si la génération a réussi
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
    };
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
