import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, SessionStatus } from '@prisma/client';
import {
  AiService,
  type DislikedJobInput,
  type PortraitContent,
  type RationaleInput,
  type RefinedJobInput,
} from '../ai/ai.service';
import { deriveUserContext, type UserContext } from '../ai/user-context';
import { JobsService, type JobProfile } from '../jobs/jobs.service';
import { MatchingService } from '../matching/matching.service';
import type { MatchingAnswer } from '../matching/matching.types';
import { PrismaService } from '../prisma/prisma.service';

type PublicQuestion = {
  id: string;
  text: string;
  type: 'SINGLE_CHOICE' | 'FREE_TEXT' | 'SUGGESTIONS_WITH_TEXT';
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

/**
 * Sous-ensemble d'une session nécessaire au raffinement (notes + réponses).
 * Typé structurellement pour que `prepareRefinement` soit réutilisable par
 * `refineResults` (legacy, vue liste) et `generateNextBatch` (swipe deck).
 */
type RefinementSession = {
  ratings: Array<{ jobSlug: string; rating: string; reason: string | null }>;
  answers: Array<{
    question: { key: string; text: string };
    option: { key: string; label: string } | null;
    freeText: string | null;
    followUpQuestion: string | null;
    followUpAnswer: string | null;
  }>;
};

/** Entrées préparées pour un appel `rankJobsWithPreferences`. */
type PreparedRefinement = {
  candidates: Array<{ code: string; libelle: string }>;
  formattedAnswers: Array<{ question: string; answer: string }>;
  likedEnriched: RefinedJobInput[];
  dislikedEnriched: DislikedJobInput[];
  userContext: UserContext;
};

/** Réponse de `generateNextBatch` (swipe deck — batches progressifs). */
type NextBatchResult = {
  /** Index global du batch (2+ pour les batches affinés). */
  batchNumber: number;
  matches: MatchOutput[];
  insight: string;
  /** false → l'utilisateur a atteint le plafond ou il n'y a plus de candidats. */
  hasMore: boolean;
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

  // ── Plafonds du raffinement progressif (swipe deck) ──────────────────────
  /** Nombre max de batches affinés générés par session (plafond coût IA). */
  private static readonly MAX_REFINED_BATCHES = 5;
  /** Notes supplémentaires requises depuis le dernier batch avant d'en générer un nouveau. */
  private static readonly MIN_NEW_RATINGS = 3;
  /** Premier numéro de batch affiné (1 = passe gratuite, stockée dans MatchResult). */
  private static readonly FIRST_REFINED_BATCH = 2;
  /** Taille d'un batch affiné. */
  private static readonly REFINED_BATCH_SIZE = 5;
  /** Candidats max envoyés à l'IA pour le reranking d'un batch. */
  private static readonly REFINE_CANDIDATE_POOL = 30;

  /**
   * Questions texte libre éligibles à une relance IA (Phase 6).
   * Choisies pour leur fort signal qualitatif sur le profil.
   */
  private static readonly FOLLOWUP_ELIGIBLE_KEYS = new Set([
    'passion_centrale',
    'metier_actuel',
    'ce_qui_pese',
    'ce_qui_garde',
    'journee_ideale',
  ]);

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

    // ── Cas : soumission d'une réponse à une relance (__followup) ────────────
    if (input.questionKey.endsWith('__followup')) {
      const parentKey = input.questionKey.replace('__followup', '');
      return this.saveFollowUpAnswer(session.id, parentKey, input.freeText);
    }

    // ── Cas : soumission d'une réponse à une question normale ────────────────
    const currentQuestion = await this.prisma.question.findUnique({
      where: { key: input.questionKey },
      include: { options: true },
    });
    if (!currentQuestion || !currentQuestion.active) {
      throw new BadRequestException('Question invalide.');
    }

    if (
      currentQuestion.type === 'FREE_TEXT' ||
      currentQuestion.type === 'SUGGESTIONS_WITH_TEXT'
    ) {
      await this.saveFreeTextAnswer(session.id, currentQuestion, input.freeText);
    } else {
      await this.saveOptionAnswer(session.id, currentQuestion, input.optionKey);
    }

    // ── Phase 6 : tentative de génération d'une relance ──────────────────────
    // Uniquement sur les questions texte libre de la whitelist, et uniquement
    // si cette question n'a pas encore reçu une relance (évite la boucle infinie).
    if (
      QuestionnaireService.FOLLOWUP_ELIGIBLE_KEYS.has(input.questionKey) &&
      (currentQuestion.type === 'FREE_TEXT' ||
        currentQuestion.type === 'SUGGESTIONS_WITH_TEXT')
    ) {
      const existingAnswer = await this.prisma.sessionAnswer.findUnique({
        where: {
          sessionId_questionId: {
            sessionId: session.id,
            questionId: currentQuestion.id,
          },
        },
      });

      // Ne génère une relance que si aucune n'existe déjà pour cette réponse
      if (existingAnswer && !existingAnswer.followUpQuestion) {
        const situation = (
          await this.prisma.sessionAnswer.findMany({
            where: { sessionId: session.id },
            include: { question: true, option: true },
          })
        ).find((a) => a.question.key === 'situation')?.option?.key ?? 'actif';
        const userContext = deriveUserContext(situation);

        const followUpText = await this.ai.generateFollowUp({
          questionKey: input.questionKey,
          parentQuestion: currentQuestion.text,
          answer: input.freeText ?? '',
          userContext,
        });

        if (followUpText) {
          // Persiste la question de relance dès maintenant (avant que l'utilisateur réponde)
          await this.prisma.sessionAnswer.update({
            where: {
              sessionId_questionId: {
                sessionId: session.id,
                questionId: currentQuestion.id,
              },
            },
            data: { followUpQuestion: followUpText },
          });

          // Retourne la relance comme prochaine question — progress gelée
          const currentProgress = await this.getCurrentProgress(session.id);
          return {
            complete: false,
            question: {
              id: `${input.questionKey}__followup`,
              text: followUpText,
              type: 'FREE_TEXT' as const,
              options: [],
            },
            progress: currentProgress,
          };
        }
      }
    }

    const { question: nextQuestion, progress } =
      await this.getNextQuestionForSession(session.id);
    return { complete: nextQuestion === null, question: nextQuestion, progress };
  }

  /** Sauvegarde la réponse à une relance dans followUpAnswer de la question parente. */
  private async saveFollowUpAnswer(
    sessionId: string,
    parentKey: string,
    freeText: string | undefined,
  ) {
    const text = (freeText ?? '').trim();
    if (text.length < 3) throw new BadRequestException('Réponse trop courte.');
    if (text.length > MAX_FREE_TEXT_LENGTH) {
      throw new BadRequestException('Réponse trop longue.');
    }

    const parentQuestion = await this.prisma.question.findUnique({
      where: { key: parentKey },
    });
    if (!parentQuestion) throw new BadRequestException('Question parente introuvable.');

    const parentAnswer = await this.prisma.sessionAnswer.findUnique({
      where: {
        sessionId_questionId: {
          sessionId,
          questionId: parentQuestion.id,
        },
      },
    });
    if (!parentAnswer) throw new BadRequestException('Réponse parente introuvable.');

    await this.prisma.sessionAnswer.update({
      where: {
        sessionId_questionId: { sessionId, questionId: parentQuestion.id },
      },
      data: { followUpAnswer: text },
    });

    const { question: nextQuestion, progress } =
      await this.getNextQuestionForSession(sessionId);
    return { complete: nextQuestion === null, question: nextQuestion, progress };
  }

  /** Calcule la progression courante sans avancer dans le flow. */
  private async getCurrentProgress(
    sessionId: string,
  ): Promise<{ answered: number; total: number | null }> {
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

    const answeredByKey = new Map<string, string>();
    for (const answer of answers) {
      answeredByKey.set(answer.question.key, answer.option?.key ?? '__free__');
    }

    const candidates = questions.filter((q) => {
      if (answeredByKey.has(q.key)) return false;
      return this.shouldAskQuestion(
        {
          askIfEquals: q.askIfEquals,
          askIfNotEquals: q.askIfNotEquals,
          askIfIn: q.askIfIn,
          askIfNotIn: q.askIfNotIn,
        },
        answeredByKey,
      );
    });

    const situationAnswered = answeredByKey.has('situation');
    return {
      answered: answers.length,
      total: situationAnswered ? answers.length + candidates.length : null,
    };
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

    // 4. Génère les rationales et le portrait en parallèle (Phase 2 produit).
    //    Les deux appels IA tournent en même temps via Promise.all : la latence
    //    totale = max(rationales, portrait) au lieu de la somme.
    const formattedAnswers: Array<{ question: string; answer: string }> = [];
    for (const a of session.answers) {
      formattedAnswers.push({
        question: a.question.text,
        answer: a.option?.label ?? a.freeText ?? '',
      });
      if (a.followUpQuestion && a.followUpAnswer) {
        formattedAnswers.push({
          question: a.followUpQuestion,
          answer: a.followUpAnswer,
        });
      }
    }

    const rationaleInput: RationaleInput = {
      topJobs: detailedMatches.slice(0, 3).map((m) => ({
        slug: m.job.slug,
        title: m.job.title,
      })),
      answers: formattedAnswers,
      userContext,
    };

    const [rationales, portrait] = await Promise.all([
      this.ai.generateRationales(rationaleInput),
      this.ai.generatePortrait({
        answers: formattedAnswers,
        userContext,
      }),
    ]);

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
        data: {
          status: SessionStatus.COMPLETED,
          expiresAt,
          portrait: portrait
            ? (portrait as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        },
      }),
    ]);

    return { sessionId, matches: finalMatches, portrait };
  }

  // ─── Retour en arrière dans le questionnaire ─────────────────────────────

  /**
   * Supprime la réponse à `questionKey` ainsi que toutes les réponses
   * ultérieures (comparaison sur createdAt).
   *
   * Permet à l'utilisateur de revenir sur une question déjà répondue sans
   * laisser des réponses incohérentes en base — l'IA de sélection de la
   * prochaine question travaillera sur un état propre.
   *
   * La session doit être ACTIVE (pas encore finalisée).
   */
  async goBackToQuestion(
    sessionId: string,
    questionKey: string,
  ): Promise<{ deleted: number }> {
    const session = await this.prisma.questionnaireSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Session introuvable');
    if (session.status !== SessionStatus.ACTIVE) {
      throw new BadRequestException(
        'La session est terminée, impossible de revenir en arrière.',
      );
    }

    // ── Phase 6 : goBack sur une relance (__followup) ────────────────────────
    // On efface uniquement followUpAnswer sur la question parente (on conserve
    // followUpQuestion pour pouvoir ré-afficher la relance si l'utilisateur
    // revient dessus via l'historique frontend).
    if (questionKey.endsWith('__followup')) {
      const parentKey = questionKey.replace('__followup', '');
      const parentQuestion = await this.prisma.question.findUnique({
        where: { key: parentKey },
      });
      if (!parentQuestion) return { deleted: 0 };

      await this.prisma.sessionAnswer.updateMany({
        where: { sessionId, questionId: parentQuestion.id },
        data: { followUpAnswer: null },
      });
      return { deleted: 0 };
    }

    // ── Cas normal : suppression de la réponse et de toutes les suivantes ────
    const question = await this.prisma.question.findUnique({
      where: { key: questionKey },
    });
    if (!question) throw new NotFoundException('Question introuvable');

    const answer = await this.prisma.sessionAnswer.findUnique({
      where: { sessionId_questionId: { sessionId, questionId: question.id } },
    });

    if (!answer) {
      return { deleted: 0 };
    }

    const result = await this.prisma.sessionAnswer.deleteMany({
      where: {
        sessionId,
        createdAt: { gte: answer.createdAt },
      },
    });

    return { deleted: result.count };
  }

  // ─── Phase 4 : notation et raffinement ───────────────────────────────────

  /**
   * Enregistre la note d'un utilisateur sur un métier.
   *
   * Idempotent via @@unique([sessionId, jobSlug]) : l'utilisateur peut
   * changer d'avis, la note est simplement mise à jour.
   * Accessible sans paiement — noter est la porte d'entrée vers le payant.
   */
  async rateJob(
    sessionId: string,
    jobSlug: string,
    rating: 'like' | 'dislike' | 'neutral',
    reason?: string,
  ): Promise<void> {
    const session = await this.prisma.questionnaireSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Session introuvable.');

    await this.prisma.jobRating.upsert({
      where: { sessionId_jobSlug: { sessionId, jobSlug } },
      update: { rating, reason: reason ?? null },
      create: { sessionId, jobSlug, rating, reason: reason ?? null },
    });
  }

  /**
   * Génère la 2e passe de résultats affinés par les notes (feature payante).
   *
   * Pipeline :
   *   1. Vérifie que la session est payée
   *   2. Cache hit → retourne directement si refinedMatches déjà en DB
   *   3. Lit les notes liked/disliked de la session
   *   4. Sélectionne des candidats dans les domaines des liked (exclut la passe 1)
   *   5. Appel IA rankJobsWithPreferences → scores + insight
   *   6. Hydrate les résultats + persiste en cache
   *
   * @throws ForbiddenException si non payé
   * @throws ServiceUnavailableException si IA indisponible
   */
  async refineResults(sessionId: string) {
    const session = await this.prisma.questionnaireSession.findUnique({
      where: { id: sessionId },
      include: {
        matches: { orderBy: { rank: 'asc' } },
        answers: { include: { question: true, option: true } },
        ratings: true,
      },
    });
    if (!session) throw new NotFoundException('Session introuvable.');

    // DEV_BYPASS_PAYMENT=true bypasse le guard de paiement indépendamment du
    // mock IA — permet de tester le paywall (false) ou non (true) séparément.
    // ⚠️ Ne jamais activer en production.
    const devBypass = process.env.DEV_BYPASS_PAYMENT === 'true';

    if (!session.isPaid && !devBypass) {
      throw new BadRequestException(
        'Le raffinement des résultats est une fonctionnalité payante.',
      );
    }

    // Cache hit — retourne directement sans rappeler l'IA
    if (session.refinedMatches !== null && session.refineInsight !== null) {
      this.logger.log(`refineResults: cache hit pour session ${sessionId}`);
      return {
        matches: session.refinedMatches as unknown as MatchOutput[],
        insight: session.refineInsight,
      };
    }

    // Candidats + signal de préférence (exclut les métiers de la passe 1).
    const excludeSlugs = new Set(session.matches.map((m) => m.jobSlug));
    const prep = await this.prepareRefinement(session, excludeSlugs);
    if (prep.candidates.length === 0) {
      throw new ServiceUnavailableException(
        'Pas assez de nouveaux métiers disponibles pour affiner les résultats.',
      );
    }

    const result = await this.ai.rankJobsWithPreferences({
      candidates: prep.candidates,
      answers: prep.formattedAnswers,
      likedJobs: prep.likedEnriched,
      dislikedJobs: prep.dislikedEnriched,
      userContext: prep.userContext,
    });
    if (!result) {
      throw new ServiceUnavailableException(
        "L'IA est temporairement indisponible. Réessaie dans quelques minutes.",
      );
    }

    // Vue liste (legacy) : pas de rationales sur la 2e passe.
    const ranked = this.rankTopCandidates(prep.candidates, result.scores);
    const detailedMatches = await this.hydrateBatch(ranked, null);

    // Persiste en cache (colonnes legacy de QuestionnaireSession).
    await this.prisma.questionnaireSession.update({
      where: { id: sessionId },
      data: {
        refinedMatches: detailedMatches as unknown as Prisma.InputJsonValue,
        refineInsight: result.insight,
      },
    });

    return { matches: detailedMatches, insight: result.insight };
  }

  // ─── Swipe deck : batches progressifs ────────────────────────────────────

  /**
   * Génère le prochain batch de métiers affinés (swipe deck).
   *
   * Contrairement à `refineResults` (un seul batch, vue liste), cette méthode
   * produit des batches successifs, chacun :
   *   - excluant TOUS les métiers déjà servis (passe 1 + batches précédents),
   *   - re-priorisé par l'IA sur l'ensemble des notes accumulées,
   *   - accompagné de rationales (contrairement à la vue liste).
   *
   * Garde-fous :
   *   - paiement requis (ou DEV_BYPASS_PAYMENT),
   *   - plafond `MAX_REFINED_BATCHES` (coût IA),
   *   - `MIN_NEW_RATINGS` nouvelles notes exigées depuis le dernier batch.
   *
   * Dégradation : si plus aucun candidat ou plafond atteint, retourne
   * `hasMore: false` avec un batch vide plutôt qu'une erreur — le frontend
   * affiche alors l'écran "tu as fait le tour".
   *
   * @throws BadRequestException si non payé ou pas assez de nouvelles notes
   * @throws ServiceUnavailableException si l'IA est indisponible
   */
  async generateNextBatch(sessionId: string): Promise<NextBatchResult> {
    const session = await this.prisma.questionnaireSession.findUnique({
      where: { id: sessionId },
      include: {
        matches: true,
        answers: { include: { question: true, option: true } },
        ratings: true,
        refinedBatches: { orderBy: { batchNumber: 'asc' } },
      },
    });
    if (!session) throw new NotFoundException('Session introuvable.');

    // ⚠️ DEV_BYPASS_PAYMENT=true ne doit jamais être activé en production.
    const devBypass = process.env.DEV_BYPASS_PAYMENT === 'true';
    if (!session.isPaid && !devBypass) {
      throw new BadRequestException(
        'Les batches affinés sont une fonctionnalité payante.',
      );
    }

    const existing = session.refinedBatches;
    const lastBatch = existing[existing.length - 1];
    const lastBatchNumber =
      lastBatch?.batchNumber ?? QuestionnaireService.FIRST_REFINED_BATCH - 1;

    // Plafond de coût IA atteint.
    if (existing.length >= QuestionnaireService.MAX_REFINED_BATCHES) {
      return {
        batchNumber: lastBatchNumber,
        matches: [],
        insight: '',
        hasMore: false,
      };
    }

    // Garde-fou anti-spam : il faut N nouvelles notes depuis le dernier batch.
    const totalRatings = session.ratings.length;
    const baseline = lastBatch?.ratingsAtCreation ?? 0;
    if (totalRatings - baseline < QuestionnaireService.MIN_NEW_RATINGS) {
      throw new BadRequestException(
        'Note encore quelques métiers pour débloquer un nouveau batch.',
      );
    }

    // Exclusion cumulée : passe 1 (MatchResult) + tous les batches déjà servis.
    const excludeSlugs = new Set<string>(session.matches.map((m) => m.jobSlug));
    for (const batch of existing) {
      for (const m of (batch.matches as unknown as MatchOutput[]) ?? []) {
        if (m?.job?.slug) excludeSlugs.add(m.job.slug);
      }
    }

    const prep = await this.prepareRefinement(session, excludeSlugs);
    // Plus de candidats disponibles → fin de parcours (pas une erreur).
    if (prep.candidates.length === 0) {
      return {
        batchNumber: lastBatchNumber,
        matches: [],
        insight: '',
        hasMore: false,
      };
    }

    const result = await this.ai.rankJobsWithPreferences({
      candidates: prep.candidates,
      answers: prep.formattedAnswers,
      likedJobs: prep.likedEnriched,
      dislikedJobs: prep.dislikedEnriched,
      userContext: prep.userContext,
    });
    if (!result) {
      throw new ServiceUnavailableException(
        "L'IA est temporairement indisponible. Réessaie dans quelques minutes.",
      );
    }

    const ranked = this.rankTopCandidates(prep.candidates, result.scores);

    // Rationales pour le batch (un seul appel IA pour les N métiers du batch).
    const rationales = await this.ai.generateRationales({
      topJobs: ranked.map((r) => ({ slug: r.code, title: r.libelle })),
      answers: prep.formattedAnswers,
      userContext: prep.userContext,
    });

    const detailedMatches = await this.hydrateBatch(ranked, rationales);
    const batchNumber = lastBatchNumber + 1;

    // Persiste le batch : c'est à la fois le cache et l'historique d'exclusion.
    await this.prisma.refinedBatch.create({
      data: {
        sessionId,
        batchNumber,
        matches: detailedMatches as unknown as Prisma.InputJsonValue,
        insight: result.insight,
        ratingsAtCreation: totalRatings,
      },
    });

    return {
      batchNumber,
      matches: detailedMatches,
      insight: result.insight,
      hasMore: existing.length + 1 < QuestionnaireService.MAX_REFINED_BATCHES,
    };
  }

  // ─── Helpers de raffinement (partagés refine ⇄ next-batch) ────────────────

  /**
   * Prépare les entrées IA communes au raffinement : sélection des candidats
   * (hors `excludeSlugs`) dans les domaines des métiers aimés, et signal de
   * préférence (liked/disliked enrichis des libellés ROME).
   *
   * Ne fait AUCun appel IA et ne lève pas d'exception sur l'absence de
   * candidats — l'appelant décide quoi faire d'un tableau `candidates` vide.
   */
  private async prepareRefinement(
    session: RefinementSession,
    excludeSlugs: Set<string>,
  ): Promise<PreparedRefinement> {
    const likedSlugs = session.ratings
      .filter((r) => r.rating === 'like')
      .map((r) => r.jobSlug);
    const dislikedRatings = session.ratings.filter(
      (r) => r.rating === 'dislike',
    );

    // Enrichit les libellés + domaines des métiers notés depuis la DB ROME.
    const ratedSlugs = session.ratings.map((r) => r.jobSlug);
    const ratedRomeJobs = await this.prisma.romeJob.findMany({
      where: { code: { in: ratedSlugs } },
      select: { code: true, libelle: true, codeGrandDomaine: true },
    });
    const libelleMap = new Map(ratedRomeJobs.map((j) => [j.code, j.libelle]));
    const domainMap = new Map(
      ratedRomeJobs.map((j) => [j.code, j.codeGrandDomaine]),
    );

    const likedEnriched: RefinedJobInput[] = likedSlugs.map((code) => ({
      code,
      libelle: libelleMap.get(code) ?? code,
    }));
    const dislikedEnriched: DislikedJobInput[] = dislikedRatings.map((r) => ({
      code: r.jobSlug,
      libelle: libelleMap.get(r.jobSlug) ?? r.jobSlug,
      reason: r.reason,
    }));

    // Domaines de base = ceux des métiers aimés ; fallback = tous les notés.
    const likedDomains = [
      ...new Set(
        likedSlugs
          .map((code) => domainMap.get(code))
          .filter((d): d is string => !!d),
      ),
    ];
    const sourceDomains =
      likedDomains.length > 0
        ? likedDomains
        : [
            ...new Set(
              ratedRomeJobs
                .map((j) => j.codeGrandDomaine)
                .filter((d): d is string => !!d),
            ),
          ];

    // Candidats : dans les domaines source, hors métiers déjà vus.
    const candidateRows = await this.prisma.romeJob.findMany({
      where: {
        codeGrandDomaine:
          sourceDomains.length > 0 ? { in: sourceDomains } : undefined,
        code: { notIn: [...excludeSlugs] },
      },
      select: { code: true, libelle: true },
    });

    // Shuffle (Fisher-Yates léger) + cap pour le prompt IA.
    const candidates = candidateRows
      .map((r) => ({ r, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(({ r }) => r)
      .slice(0, QuestionnaireService.REFINE_CANDIDATE_POOL);

    // UserContext dérivé de la clé `situation` (étudiant/pro) + réponses
    // formatées pour le prompt (relances Phase 6 incluses).
    const situationKey =
      session.answers.find((a) => a.question.key === 'situation')?.option?.key ??
      'actif';
    const userContext = deriveUserContext(situationKey);

    const formattedAnswers: Array<{ question: string; answer: string }> = [];
    for (const a of session.answers) {
      formattedAnswers.push({
        question: a.question.text,
        answer: a.option?.label ?? a.freeText ?? '',
      });
      if (a.followUpQuestion && a.followUpAnswer) {
        formattedAnswers.push({
          question: a.followUpQuestion,
          answer: a.followUpAnswer,
        });
      }
    }

    return {
      candidates,
      formattedAnswers,
      likedEnriched,
      dislikedEnriched,
      userContext,
    };
  }

  /** Top N candidats par score IA (ordre décroissant). */
  private rankTopCandidates(
    candidates: Array<{ code: string; libelle: string }>,
    scores: Record<string, number>,
  ): Array<{ code: string; libelle: string; score: number }> {
    return candidates
      .map((c) => ({
        code: c.code,
        libelle: c.libelle,
        score: scores[c.code] ?? 0,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, QuestionnaireService.REFINED_BATCH_SIZE);
  }

  /** Hydrate les métiers classés avec la fiche complète + rationale optionnelle. */
  private async hydrateBatch(
    ranked: Array<{ code: string; libelle: string; score: number }>,
    rationales: Record<string, string> | null,
  ): Promise<MatchOutput[]> {
    return Promise.all(
      ranked.map(async (m) => ({
        job: await this.jobs.findBySlug(m.code),
        score: m.score,
        scorePercent: m.score,
        rationale: rationales?.[m.code] ?? null,
      })),
    );
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
        refinedBatches: { orderBy: { batchNumber: 'asc' } },
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

    // Batches affinés (swipe deck) : déjà hydratés et figés en JSON à la
    // génération — on les renvoie tels quels pour restauration côté frontend.
    const refinedBatches = session.refinedBatches.map((b) => ({
      batchNumber: b.batchNumber,
      matches: b.matches as unknown as MatchOutput[],
      insight: b.insight ?? '',
    }));

    return {
      sessionId: session.id,
      matches,
      refinedBatches,
      isPaid: session.isPaid,
      expiresAt: session.expiresAt?.toISOString() ?? null,
      portrait: this.parsePortrait(session.portrait),
    };
  }

  /**
   * Parse défensif du portrait stocké en JSON.
   *
   * On ne fait pas confiance aveuglément à la DB : la structure peut être
   * obsolète (changement de schéma) ou incomplète (panne IA partielle).
   * On retourne null si une seule des clés attendues est manquante.
   */
  private parsePortrait(raw: unknown): PortraitContent | null {
    if (!raw || typeof raw !== 'object') return null;
    const obj = raw as Record<string, unknown>;
    const archetype = typeof obj.archetype === 'string' ? obj.archetype : null;
    const summary = typeof obj.summary === 'string' ? obj.summary : null;
    const thrives = typeof obj.thrives === 'string' ? obj.thrives : null;
    const drains = typeof obj.drains === 'string' ? obj.drains : null;
    const strengths = Array.isArray(obj.strengths)
      ? obj.strengths.filter((s): s is string => typeof s === 'string')
      : null;

    if (!archetype || !summary || !thrives || !drains || !strengths || strengths.length === 0) {
      return null;
    }
    return { archetype, summary, strengths, thrives, drains };
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
            type: this.toPublicType(situationQ.type),
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
        type: this.toPublicType(chosen.type),
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

  private toPublicType(type: string): PublicQuestion['type'] {
    if (type === 'FREE_TEXT' || type === 'SUGGESTIONS_WITH_TEXT') return type;
    return 'SINGLE_CHOICE';
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
    if (
      question.type === 'FREE_TEXT' ||
      question.type === 'SUGGESTIONS_WITH_TEXT'
    ) {
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
