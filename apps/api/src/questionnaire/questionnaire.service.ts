import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SessionStatus } from '@prisma/client';
import { AiService, type RationaleInput } from '../ai/ai.service';
import { JobsService, type JobProfile } from '../jobs/jobs.service';
import { MatchingService } from '../matching/matching.service';
import type { MatchingAnswer } from '../matching/matching.types';
import { PrismaService } from '../prisma/prisma.service';

type PublicQuestion = {
  id: string;
  text: string;
  type: 'SINGLE_CHOICE' | 'FREE_TEXT';
  placeholder?: string;
  helperText?: string;
  options: { id: string; label: string }[];
};

const MAX_FREE_TEXT_LENGTH = 2000;

type MatchOutput = {
  job: JobProfile;
  /** Score normalisé 0-100. */
  score: number;
  /** Identique à `score` côté frontend (rétrocompatibilité). */
  scorePercent: number;
  /** Explication personnalisée IA. Null si IA désactivée. */
  rationale: string | null;
};

@Injectable()
export class QuestionnaireService {
  private readonly logger = new Logger(QuestionnaireService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly ai: AiService,
    private readonly matching: MatchingService,
  ) {}

  // ─── Lifecycle session ────────────────────────────────────────────────────

  async startSession(metadata?: Record<string, unknown>) {
    const session = await this.prisma.questionnaireSession.create({
      data: {
        metadata: metadata
          ? (metadata as Prisma.InputJsonValue)
          : ({} as Prisma.InputJsonValue),
      },
    });
    const next = await this.getNextQuestionForSession(session.id);
    return { sessionId: session.id, complete: next === null, question: next };
  }

  async answerAndGetNext(input: {
    sessionId: string;
    questionKey: string;
    optionKey?: string;
    freeText?: string;
  }) {
    const session = await this.prisma.questionnaireSession.findUnique({
      where: { id: input.sessionId },
    });
    if (!session) throw new NotFoundException('Session introuvable');
    if (session.status !== SessionStatus.ACTIVE) {
      throw new BadRequestException('La session est déjà terminée.');
    }

    const question = await this.prisma.question.findUnique({
      where: { key: input.questionKey },
      include: { options: true },
    });
    if (!question || !question.active) {
      throw new BadRequestException('Question invalide.');
    }

    if (question.type === 'FREE_TEXT') {
      await this.saveFreeTextAnswer(session.id, question, input.freeText);
    } else {
      await this.saveOptionAnswer(session.id, question, input.optionKey);
    }

    const next = await this.getNextQuestionForSession(session.id);
    return { complete: next === null, question: next };
  }

  // ─── Sauvegarde des réponses ──────────────────────────────────────────────

  private async saveOptionAnswer(
    sessionId: string,
    question: { id: string; options: Array<{ id: string; key: string }> },
    optionKey: string | undefined,
  ): Promise<void> {
    if (!optionKey) throw new BadRequestException('Option manquante.');
    const option = question.options.find((opt) => opt.key === optionKey);
    if (!option) throw new BadRequestException('Option invalide.');

    await this.prisma.sessionAnswer.upsert({
      where: {
        sessionId_questionId: { sessionId, questionId: question.id },
      },
      update: {
        optionId: option.id,
        freeText: null,
      },
      create: {
        sessionId,
        questionId: question.id,
        optionId: option.id,
      },
    });
  }

  private async saveFreeTextAnswer(
    sessionId: string,
    question: { id: string; text: string },
    rawText: string | undefined,
  ): Promise<void> {
    const text = (rawText ?? '').trim();
    if (text.length < 3) throw new BadRequestException('Réponse trop courte.');
    if (text.length > MAX_FREE_TEXT_LENGTH) {
      throw new BadRequestException('Réponse trop longue.');
    }

    // En Phase 2, le texte libre n'alimente plus le scoring par domaine
    // (qui se fait sur les options QCM). Le texte est conservé en base et
    // sera transmis à l'IA lors du reranking final, où il a tout son impact.
    await this.prisma.sessionAnswer.upsert({
      where: {
        sessionId_questionId: { sessionId, questionId: question.id },
      },
      update: {
        optionId: null,
        freeText: text,
      },
      create: {
        sessionId,
        questionId: question.id,
        freeText: text,
      },
    });
  }

  // ─── Finalisation : pipeline de matching ROME ─────────────────────────────

  /**
   * Termine la session et calcule le top des métiers ROME correspondant
   * au profil de l'utilisateur.
   *
   * Pipeline (délégué à MatchingService) :
   *   1. Score par grand domaine ROME (à partir des `domainWeights` des options)
   *   2. Sélection des top 3 grands domaines
   *   3. Récupération des métiers candidats
   *   4. Reranking IA selon le profil complet (réponses QCM + texte libre)
   *
   * Puis :
   *   5. Génération des rationales IA pour le top 3
   *   6. Persistance en MatchResult
   */
  async finishSession(sessionId: string) {
    const session = await this.prisma.questionnaireSession.findUnique({
      where: { id: sessionId },
      include: {
        answers: {
          include: { question: true, option: true },
        },
      },
    });
    if (!session) throw new NotFoundException('Session introuvable');
    if (session.answers.length === 0) {
      throw new BadRequestException('Aucune réponse enregistrée.');
    }

    // 1. Construit les MatchingAnswer attendues par le pipeline
    const matchingAnswers: MatchingAnswer[] = session.answers.map((a) => ({
      question: a.question.text,
      answer: a.option?.label ?? a.freeText ?? '',
      domainWeights: this.parseDomainWeights(a.option?.domainWeights ?? null),
    }));

    // 2. Pipeline complet : scoring → fetch → reranking IA
    const matched = await this.matching.findBestJobs(matchingAnswers, {
      topDomainsCount: 3,
      finalTopN: 10,
    });

    if (matched.length === 0) {
      this.logger.warn(
        `Aucun métier matché pour la session ${sessionId}. La table RomeJob est-elle peuplée ?`,
      );
      // On termine quand même la session, juste avec un classement vide
      await this.prisma.$transaction([
        this.prisma.matchResult.deleteMany({ where: { sessionId } }),
        this.prisma.questionnaireSession.update({
          where: { id: sessionId },
          data: { status: SessionStatus.COMPLETED },
        }),
      ]);
      return { sessionId, matches: [] };
    }

    // 3. Hydrate les résultats avec les détails complets de chaque métier
    const detailedMatches = await Promise.all(
      matched.map(async (m) => ({
        job: await this.jobs.findBySlug(m.code),
        score: m.score,
        rank: m.rank,
      })),
    );

    // 4. Génère les rationales IA pour le top 3
    const rationaleInput: RationaleInput = {
      topJobs: detailedMatches.slice(0, 3).map((m) => ({
        slug: m.job.slug,
        title: m.job.title,
      })),
      answers: session.answers.map((a) => ({
        question: a.question.text,
        answer: a.option?.label ?? a.freeText ?? '',
      })),
    };
    const rationales = await this.ai.generateRationales(rationaleInput);

    const finalMatches: MatchOutput[] = detailedMatches.map((m) => ({
      job: m.job,
      score: m.score,
      // scorePercent gardé identique au score (déjà 0-100 en sortie d'IA)
      // pour ne pas casser le contrat avec le frontend.
      scorePercent: m.score,
      rationale: rationales?.[m.job.slug] ?? null,
    }));

    // 5. Persistance : on remplace tous les anciens MatchResult de la session
    await this.prisma.$transaction([
      this.prisma.matchResult.deleteMany({ where: { sessionId } }),
      this.prisma.matchResult.createMany({
        data: detailedMatches.map((m, index) => ({
          sessionId,
          jobSlug: m.job.slug, // Code ROME stocké comme identifiant
          score: m.score,
          rank: index + 1,
          rationale: finalMatches[index].rationale,
        })),
      }),
      this.prisma.questionnaireSession.update({
        where: { id: sessionId },
        data: { status: SessionStatus.COMPLETED },
      }),
    ]);

    return { sessionId, matches: finalMatches };
  }

  /** Parse défensif du JSON `domainWeights` venant de la DB. */
  private parseDomainWeights(
    raw: unknown,
  ): Record<string, number> | null {
    if (!raw || typeof raw !== 'object') return null;
    const result: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === 'number' && !Number.isNaN(v)) result[k] = v;
    }
    return Object.keys(result).length > 0 ? result : null;
  }

  // ─── Sélection adaptative de la prochaine question ────────────────────────

  private async getNextQuestionForSession(
    sessionId: string,
  ): Promise<PublicQuestion | null> {
    const [questions, answers] = await Promise.all([
      this.prisma.question.findMany({
        where: { active: true },
        orderBy: { orderHint: 'asc' },
        include: { options: true },
      }),
      this.prisma.sessionAnswer.findMany({
        where: { sessionId },
        include: { question: true, option: true },
      }),
    ]);

    // Sentinelle pour les réponses texte libre (pas d'option key associée).
    const answeredByKey = new Map<string, string>();
    for (const answer of answers) {
      answeredByKey.set(answer.question.key, answer.option?.key ?? '__free__');
    }

    const candidates = questions.filter((question) => {
      if (answeredByKey.has(question.key)) return false;
      if (!this.shouldAskQuestion(question, answeredByKey)) return false;
      return true;
    });
    if (candidates.length === 0) return null;

    const sortedCandidates = this.sortByDiscriminatoryPower(candidates);
    const shortlist = sortedCandidates.slice(0, 4);
    const aiChoice = await this.ai.chooseQuestion({
      candidateKeys: shortlist.map((q) => q.key),
      answers: answers.map((a) => ({
        question: a.question.text,
        option: a.option?.label ?? (a.freeText ?? '').slice(0, 200),
      })),
    });
    const chosen = shortlist.find((q) => q.key === aiChoice) ?? shortlist[0];

    return {
      id: chosen.key,
      text: chosen.text,
      type: chosen.type === 'FREE_TEXT' ? 'FREE_TEXT' : 'SINGLE_CHOICE',
      placeholder: chosen.placeholder ?? undefined,
      helperText: chosen.helperText ?? undefined,
      options: chosen.options.map((opt) => ({ id: opt.key, label: opt.label })),
    };
  }

  private shouldAskQuestion(
    question: { askIfEquals: unknown; askIfNotEquals: unknown },
    answeredByKey: Map<string, string>,
  ): boolean {
    const askIfEquals = this.normalizeCondition(question.askIfEquals);
    const askIfNotEquals = this.normalizeCondition(question.askIfNotEquals);

    if (askIfEquals) {
      for (const [key, expected] of Object.entries(askIfEquals)) {
        if (answeredByKey.get(key) !== expected) return false;
      }
    }
    if (askIfNotEquals) {
      for (const [key, blocked] of Object.entries(askIfNotEquals)) {
        if (answeredByKey.get(key) === blocked) return false;
      }
    }
    return true;
  }

  private normalizeCondition(value: unknown): Record<string, string> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (typeof v === 'string') result[k] = v;
    }
    return Object.keys(result).length > 0 ? result : null;
  }

  /** Score arbitraire pour les questions FREE_TEXT (signal qualitatif fort). */
  private static readonly FREE_TEXT_VARIANCE_PROXY = 6;

  private sortByDiscriminatoryPower<
    T extends { type: string; options: Array<{ jobWeights: unknown }> },
  >(questions: T[]): T[] {
    return [...questions].sort(
      (a, b) => this.varianceScore(b) - this.varianceScore(a),
    );
  }

  private varianceScore(question: {
    type: string;
    options: Array<{ jobWeights: unknown }>;
  }): number {
    if (question.type === 'FREE_TEXT') {
      return QuestionnaireService.FREE_TEXT_VARIANCE_PROXY;
    }
    const allScores: number[] = [];
    for (const option of question.options) {
      const weights = option.jobWeights;
      if (!weights || typeof weights !== 'object') continue;
      for (const value of Object.values(weights as Record<string, unknown>)) {
        if (typeof value === 'number' && !Number.isNaN(value)) {
          allScores.push(value);
        }
      }
    }
    if (allScores.length <= 1) return 0;
    const mean = allScores.reduce((sum, v) => sum + v, 0) / allScores.length;
    return (
      allScores.reduce((sum, v) => sum + (v - mean) ** 2, 0) / allScores.length
    );
  }
}
