import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, SessionStatus } from '@prisma/client';
import { AiService, type RationaleInput } from '../ai/ai.service';
import { deriveUserContext } from '../ai/user-context';
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

type Progress = {
  /** Nombre de questions déjà répondues dans cette session. */
  answered: number;
  /**
   * Total de questions attendues pour ce parcours (calculé dynamiquement
   * selon la situation de l'utilisateur, donc le track A ou B).
   * Null si le parcours n'est pas encore déterminé (avant la question `situation`).
   */
  total: number | null;
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
    const { question, progress } = await this.getNextQuestionForSession(session.id);
    return {
      sessionId: session.id,
      complete: question === null,
      question,
      progress,
    };
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

    const currentQuestion = await this.prisma.question.findUnique({
      where: { key: input.questionKey },
      include: { options: true },
    });
    if (!currentQuestion || !currentQuestion.active) {
      throw new BadRequestException('Question invalide.');
    }

    if (currentQuestion.type === 'FREE_TEXT') {
      await this.saveFreeTextAnswer(session.id, currentQuestion, input.freeText);
    } else {
      await this.saveOptionAnswer(session.id, currentQuestion, input.optionKey);
    }

    const { question: nextQuestion, progress } = await this.getNextQuestionForSession(session.id);
    return { complete: nextQuestion === null, question: nextQuestion, progress };
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

    // 2. Calcule le UserContext depuis la situation déclarée par l'utilisateur.
    // Utilisé pour adapter les prompts IA (angle étudiant vs professionnel).
    const situationAnswer = session.answers.find(
      (a) => a.question.key === 'situation',
    );
    const situation = situationAnswer?.option?.key ?? 'actif';
    const userContext = deriveUserContext(situation);

    this.logger.log(
      `Session ${sessionId} — track: ${userContext.track} (situation: ${situation})`,
    );

    // 3. Pipeline complet : scoring → fetch → reranking IA
    const matched = await this.matching.findBestJobs(matchingAnswers, {
      topDomainsCount: 3,
      finalTopN: 10,
      userContext,
    });

    // null = IA totalement indisponible (quota, tous providers en erreur…)
    // On lève un 503 : mieux vaut un message d'erreur honnête que des résultats
    // sans pertinence (secrétaire médicale pour un profil dev…).
    if (matched === null) {
      this.logger.warn(
        `Session ${sessionId} : matching impossible — IA indisponible.`,
      );
      throw new ServiceUnavailableException(
        'Notre moteur de recommandation est temporairement indisponible. ' +
          'Réessaie dans quelques minutes.',
      );
    }

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

    // 4. Génère les rationales IA pour le top 3 (avec contexte utilisateur)
    const rationaleInput: RationaleInput = {
      topJobs: detailedMatches.slice(0, 3).map((m) => ({
        slug: m.job.slug,
        title: m.job.title,
      })),
      answers: session.answers.map((a) => ({
        question: a.question.text,
        answer: a.option?.label ?? a.freeText ?? '',
      })),
      userContext,
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
    // L'expiration à 30 jours démarre maintenant (depuis la fin du questionnaire).
    // Elle sera prolongée à 1 an si l'utilisateur paie (cf. BillingService).
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await this.prisma.$transaction([
      this.prisma.matchResult.deleteMany({ where: { sessionId } }),
      this.prisma.matchResult.createMany({
        data: detailedMatches.map((m, index) => ({
          sessionId,
          jobSlug: m.job.slug,
          score: m.score,
          rank: index + 1,
          rationale: finalMatches[index].rationale,
        })),
      }),
      this.prisma.questionnaireSession.update({
        where: { id: sessionId },
        data: { status: SessionStatus.COMPLETED, expiresAt },
      }),
    ]);

    return { sessionId, matches: finalMatches };
  }

  /**
   * Restaure les résultats d'une session depuis la DB via un lien email.
   *
   * Sécurité : l'email fourni doit correspondre exactement à celui de la session
   * (vérification anti-partage de lien). Utiliser toLowerCase() des deux côtés
   * pour éviter les problèmes de casse.
   *
   * Retourne un objet identique à ce que le frontend stocke dans localStorage :
   * matches + isPaid + expiresAt pour permettre la restauration complète.
   */
  async restoreSession(sessionId: string, email: string) {
    const session = await this.prisma.questionnaireSession.findUnique({
      where: { id: sessionId },
      include: {
        matches: { orderBy: { rank: 'asc' } },
      },
    });

    if (!session) {
      throw new NotFoundException('Session introuvable.');
    }

    // Pas d'email en DB = l'utilisateur avait skipé → pas de restauration
    if (!session.email) {
      throw new BadRequestException(
        'Aucun email associé à cette session. La restauration nécessite un email.',
      );
    }

    // Anti-partage : l'email doit correspondre
    if (session.email.toLowerCase() !== email.toLowerCase().trim()) {
      throw new BadRequestException('Email incorrect.');
    }

    // Vérification de l'expiration
    if (session.expiresAt && new Date() > session.expiresAt) {
      throw new BadRequestException(
        'Ces résultats ont expiré. Lance un nouveau questionnaire pour une analyse fraîche.',
      );
    }

    // Hydrate les résultats avec les détails complets du job
    const matches = await Promise.all(
      session.matches.map(async (m) => {
        const job = await this.jobs.findBySlug(m.jobSlug);
        return {
          job,
          score: m.score,
          scorePercent: Math.round(m.score),
          rationale: m.rationale ?? null,
        };
      }),
    );

    return {
      sessionId: session.id,
      matches,
      isPaid: session.isPaid,
      expiresAt: session.expiresAt?.toISOString() ?? null,
    };
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
  ): Promise<{ question: PublicQuestion | null; progress: Progress }> {
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
      if (!this.shouldAskQuestion(
        {
          askIfEquals: question.askIfEquals,
          askIfNotEquals: question.askIfNotEquals,
          askIfIn: question.askIfIn,
          askIfNotIn: question.askIfNotIn,
        },
        answeredByKey,
      )) return false;
      return true;
    });

    // ── Calcul de la progression ───────────────────────────────────────────
    // Le total est calculé dynamiquement : questions déjà répondues + questions
    // encore à venir pour CE parcours. Null si la situation n'est pas encore connue
    // (avant la Q1 "situation"), car on ne sait pas encore quel track sera affiché.
    const situationAnswered = answeredByKey.has('situation');
    const total: number | null = situationAnswered
      ? answers.length + candidates.length
      : null;

    const progress: Progress = {
      answered: answers.length,
      total,
    };

    if (candidates.length === 0) {
      return { question: null, progress };
    }

    // ── Garantie : `situation` est toujours posée en premier ───────────────
    // `situation` détermine le track (étudiant vs professionnel) et conditionne
    // toutes les questions askIfIn/askIfNotIn. Sans elle, le total du progress
    // reste null et les questions de track ne sont jamais proposées.
    // On la retourne directement sans passer par le tri IA.
    if (!answeredByKey.has('situation')) {
      const situationQ = candidates.find((q) => q.key === 'situation');
      if (situationQ) {
        return {
          question: {
            id: situationQ.key,
            text: situationQ.text,
            type: situationQ.type === 'FREE_TEXT' ? 'FREE_TEXT' : 'SINGLE_CHOICE',
            placeholder: situationQ.placeholder ?? undefined,
            helperText: situationQ.helperText ?? undefined,
            options: situationQ.options.map((opt) => ({
              id: opt.key,
              label: opt.label,
            })),
          },
          progress,
        };
      }
    }

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
      question: {
        id: chosen.key,
        text: chosen.text,
        type: chosen.type === 'FREE_TEXT' ? 'FREE_TEXT' : 'SINGLE_CHOICE',
        placeholder: chosen.placeholder ?? undefined,
        helperText: chosen.helperText ?? undefined,
        options: chosen.options.map((opt) => ({ id: opt.key, label: opt.label })),
      },
      progress,
    };
  }

  /**
   * Détermine si une question doit être posée à l'utilisateur.
   *
   * Évalue les quatre conditions optionnelles dans l'ordre :
   *   1. askIfEquals    — la réponse doit correspondre exactement à la valeur
   *   2. askIfNotEquals — la réponse ne doit pas correspondre à la valeur
   *   3. askIfIn        — la réponse doit être dans le tableau de valeurs
   *   4. askIfNotIn     — la réponse ne doit pas être dans le tableau de valeurs
   *
   * Toutes les conditions présentes doivent être satisfaites (AND logique).
   * Une question sans condition est toujours posée.
   */
  private shouldAskQuestion(
    question: {
      askIfEquals: unknown;
      askIfNotEquals: unknown;
      askIfIn: unknown;
      askIfNotIn: unknown;
    },
    answeredByKey: Map<string, string>,
  ): boolean {
    const askIfEquals = this.normalizeStringCondition(question.askIfEquals);
    const askIfNotEquals = this.normalizeStringCondition(question.askIfNotEquals);
    const askIfIn = this.normalizeArrayCondition(question.askIfIn);
    const askIfNotIn = this.normalizeArrayCondition(question.askIfNotIn);

    // La réponse doit être exactement la valeur attendue
    if (askIfEquals) {
      for (const [key, expected] of Object.entries(askIfEquals)) {
        if (answeredByKey.get(key) !== expected) return false;
      }
    }

    // La réponse ne doit pas être la valeur bloquée
    if (askIfNotEquals) {
      for (const [key, blocked] of Object.entries(askIfNotEquals)) {
        if (answeredByKey.get(key) === blocked) return false;
      }
    }

    // La réponse doit être dans le tableau de valeurs autorisées
    if (askIfIn) {
      for (const [key, allowedValues] of Object.entries(askIfIn)) {
        const answer = answeredByKey.get(key);
        if (!answer || !allowedValues.includes(answer)) return false;
      }
    }

    // La réponse ne doit pas être dans le tableau de valeurs bloquées
    if (askIfNotIn) {
      for (const [key, blockedValues] of Object.entries(askIfNotIn)) {
        const answer = answeredByKey.get(key);
        if (answer && blockedValues.includes(answer)) return false;
      }
    }

    return true;
  }

  /**
   * Parse une condition de type chaîne : { key: "value" }.
   * Retourne null si la valeur est absente ou malformée.
   */
  private normalizeStringCondition(value: unknown): Record<string, string> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (typeof v === 'string') result[k] = v;
    }
    return Object.keys(result).length > 0 ? result : null;
  }

  /**
   * Parse une condition de type tableau : { key: ["v1", "v2"] }.
   * Filtre les entrées non-string pour rester défensif face à une DB corrompue.
   */
  private normalizeArrayCondition(value: unknown): Record<string, string[]> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const result: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (!Array.isArray(v)) continue;
      const strings = v.filter((item): item is string => typeof item === 'string');
      if (strings.length > 0) result[k] = strings;
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
