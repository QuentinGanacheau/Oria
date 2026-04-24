import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SessionStatus } from '@prisma/client';
import { AiService, type RationaleInput } from '../ai/ai.service';
import { JobsService } from '../jobs/jobs.service';
import type { JobProfile, JobSlug } from '../jobs/job.types';
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

type MatchResult = {
  job: JobProfile;
  score: number;
  scorePercent: number;
  /** Explication personnalisée générée par l'IA. Null si IA désactivée ou en erreur. */
  rationale: string | null;
};

@Injectable()
export class QuestionnaireService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly ai: AiService,
  ) {}

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
    if (!question || !question.active) throw new BadRequestException('Question invalide.');

    // Dispatch selon le type de question
    if (question.type === 'FREE_TEXT') {
      await this.saveFreeTextAnswer(session.id, question, input.freeText);
    } else {
      await this.saveOptionAnswer(session.id, question, input.optionKey);
    }

    const next = await this.getNextQuestionForSession(session.id);
    return { complete: next === null, question: next };
  }

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
        extractedWeights: Prisma.JsonNull,
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

    // Extraction IA des poids métiers — peut échouer ou retourner null
    // si pas de clé API : on persiste quand même le texte (signal qualitatif conservé).
    const weights = await this.ai.extractWeightsFromText({
      question: question.text,
      text,
      jobSlugs: this.jobs.listSlugs(),
    });

    await this.prisma.sessionAnswer.upsert({
      where: {
        sessionId_questionId: { sessionId, questionId: question.id },
      },
      update: {
        optionId: null,
        freeText: text,
        extractedWeights: weights
          ? (weights as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
      create: {
        sessionId,
        questionId: question.id,
        freeText: text,
        extractedWeights: weights
          ? (weights as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });
  }

  async finishSession(sessionId: string) {
    const session = await this.prisma.questionnaireSession.findUnique({
      where: { id: sessionId },
      include: {
        answers: {
          include: {
            question: true,
            option: true,
          },
        },
      },
    });
    if (!session) throw new NotFoundException('Session introuvable');
    if (session.answers.length === 0) {
      throw new BadRequestException('Aucune réponse enregistrée.');
    }

    const totals = this.computeBaseScores(session.answers);
    const ranked = await this.rankWithOptionalAi(totals, session.answers);

    // On prépare le contexte pour la génération des rationales :
    // toutes les réponses de la session, en unifiant QCM (label de l'option)
    // et texte libre sous le même format.
    const rationaleInput: RationaleInput = {
      topJobs: ranked.slice(0, 3).map((m) => ({
        slug: m.job.slug,
        title: m.job.title,
      })),
      answers: session.answers.map((a) => ({
        question: a.question.text,
        answer: a.option?.label ?? a.freeText ?? '',
      })),
    };
    const rationales = await this.ai.generateRationales(rationaleInput);

    // Merge rationale dans les résultats + persistance en base
    const rankedWithRationale: MatchResult[] = ranked.map((m) => ({
      ...m,
      rationale: rationales?.[m.job.slug] ?? null,
    }));

    await this.prisma.$transaction([
      this.prisma.matchResult.deleteMany({ where: { sessionId } }),
      this.prisma.matchResult.createMany({
        data: rankedWithRationale.map((item, index) => ({
          sessionId,
          jobSlug: item.job.slug,
          score: item.score,
          rank: index + 1,
          rationale: item.rationale,
        })),
      }),
      this.prisma.questionnaireSession.update({
        where: { id: sessionId },
        data: { status: SessionStatus.COMPLETED },
      }),
    ]);

    return { sessionId, matches: rankedWithRationale };
  }

  private computeBaseScores(
    answers: Array<{
      option: { jobWeights: unknown } | null;
      extractedWeights: unknown;
    }>,
  ): Record<JobSlug, number> {
    // Construction dynamique depuis le catalogue : on n'a plus jamais
    // à modifier ce code quand on ajoute ou retire un métier.
    const totals = Object.fromEntries(
      this.jobs.listSlugs().map((slug) => [slug, 0]),
    ) as Record<JobSlug, number>;

    for (const answer of answers) {
      // Une réponse = soit une option QCM (option.jobWeights),
      // soit un texte libre avec extractedWeights fournis par l'IA.
      const weights = answer.option?.jobWeights ?? answer.extractedWeights;
      if (!weights || typeof weights !== 'object') continue;
      for (const [slug, points] of Object.entries(weights as Record<string, unknown>)) {
        if (!this.jobs.isValidSlug(slug)) continue;
        if (typeof points !== 'number' || Number.isNaN(points)) continue;
        totals[slug] += points;
      }
    }
    return totals;
  }

  private async rankWithOptionalAi(
    totals: Record<JobSlug, number>,
    answers: Array<{
      question: { text: string };
      option: { label: string } | null;
      freeText: string | null;
    }>,
  ): Promise<MatchResult[]> {
    const base = (Object.keys(totals) as JobSlug[])
      .map((slug) => ({
        slug,
        score: totals[slug],
      }))
      .sort((a, b) => b.score - a.score);

    const multipliers = await this.ai.adjustScores({
      topJobs: base.slice(0, 5),
      // Pour les réponses texte libre on passe le texte brut à l'IA, tronqué pour limiter les tokens
      answers: answers.map((a) => ({
        question: a.question.text,
        option: a.option?.label ?? (a.freeText ?? '').slice(0, 300),
      })),
    });

    const withAi = base.map((entry) => ({
      slug: entry.slug,
      score: entry.score * (multipliers?.[entry.slug] ?? 1),
    }));
    withAi.sort((a, b) => b.score - a.score);

    const maxRaw = Math.max(...withAi.map((x) => x.score), 1);
    // rationale est null ici : il sera renseigné par finishSession après l'appel generateRationales
    return withAi.map((entry) => ({
      job: this.jobs.findBySlug(entry.slug),
      score: Number(entry.score.toFixed(3)),
      scorePercent: Math.round((entry.score / maxRaw) * 100),
      rationale: null,
    }));
  }

  private async getNextQuestionForSession(sessionId: string): Promise<PublicQuestion | null> {
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

    // Pour les conditions askIf*, seules les réponses QCM ont une clé d'option identifiable.
    // Les réponses texte libre sont marquées présentes via une sentinelle "__free__".
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

  // Score arbitraire considéré comme "élevé" pour les questions texte libre : on les considère
  // comme très discriminantes (signal riche non réductible à la variance de poids d'options).
  private static readonly FREE_TEXT_VARIANCE_PROXY = 6;

  private sortByDiscriminatoryPower<
    T extends { type: string; options: Array<{ jobWeights: unknown }> },
  >(questions: T[]): T[] {
    return [...questions].sort((a, b) => this.varianceScore(b) - this.varianceScore(a));
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
    return allScores.reduce((sum, v) => sum + (v - mean) ** 2, 0) / allScores.length;
  }
}
