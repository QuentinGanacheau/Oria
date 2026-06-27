import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AnswerNextDto } from './dto/answer-next.dto';
import { FinishSessionDto } from './dto/finish-session.dto';
import { GoBackDto } from './dto/go-back.dto';
import { NextBatchDto } from './dto/next-batch.dto';
import { RateJobDto } from './dto/rate-job.dto';
import { RestoreSessionDto } from './dto/restore-session.dto';
import { StartSessionDto } from './dto/start-session.dto';
import { QuestionnaireService } from './questionnaire.service';

@Controller('questionnaire')
export class QuestionnaireController {
  constructor(private readonly questionnaire: QuestionnaireService) {}

  @Post('start')
  start(@Body() body: StartSessionDto) {
    return this.questionnaire.startSession(body.metadata);
  }

  @Post('match')
  finish(@Body() body: FinishSessionDto) {
    return this.questionnaire.finishSession(body.sessionId);
  }

  @Post('next')
  next(@Body() body: AnswerNextDto) {
    return this.questionnaire.answerAndGetNext(body);
  }

  /**
   * POST /v1/questionnaire/:sessionId/rate
   *
   * Enregistre la note d'un utilisateur sur un métier (👍/👎/🤔).
   * Idempotent — on peut changer d'avis, la note est mise à jour.
   * Accessible sans paiement (noter = porte d'entrée vers la passe 2 payante).
   */
  /**
   * POST /v1/questionnaire/:sessionId/back
   *
   * Supprime la réponse à `questionKey` et toutes les réponses ultérieures,
   * permettant à l'utilisateur de revenir en arrière dans le questionnaire.
   * La session doit être ACTIVE.
   */
  @Post(':sessionId/back')
  back(@Param('sessionId') sessionId: string, @Body() body: GoBackDto) {
    return this.questionnaire.goBackToQuestion(sessionId, body.questionKey);
  }

  @Post(':sessionId/rate')
  async rate(
    @Param('sessionId') sessionId: string,
    @Body() body: RateJobDto,
  ) {
    await this.questionnaire.rateJob(
      sessionId,
      body.jobSlug,
      body.rating,
      body.reason,
    );
    return { ok: true };
  }

  /**
   * POST /v1/questionnaire/:sessionId/refine
   *
   * Génère la 2e passe de résultats affinés par les notes.
   * Protégé : session.isPaid doit être true → 400 sinon.
   * Idempotent via cache DB : si déjà généré, retourne le cache.
   */
  @Post(':sessionId/refine')
  refine(@Param('sessionId') sessionId: string) {
    return this.questionnaire.refineResults(sessionId);
  }

  /**
   * POST /v1/questionnaire/:sessionId/next-batch
   *
   * Génère le prochain batch de métiers affinés (swipe deck — batches
   * progressifs). Chaque appel produit un batch excluant les métiers déjà vus.
   * Protégé (session payée) + plafonné (MAX_REFINED_BATCHES, MIN_NEW_RATINGS).
   *
   * Retourne `{ batchNumber, matches, insight, hasMore }`. `hasMore: false`
   * signale au frontend qu'il n'y a plus de batch à demander.
   */
  @Post(':sessionId/next-batch')
  nextBatch(@Param('sessionId') sessionId: string, @Body() body: NextBatchDto) {
    return this.questionnaire.generateNextBatch(sessionId, body.probeAnswer);
  }

  /**
   * POST /v1/questionnaire/:sessionId/next-batch/probe
   *
   * Génère (ou récupère, idempotent) la question d'affinage A/B qui précède le
   * prochain batch du swipe deck. Protégé (session payée). Renvoie la question
   * `{ intro, axisA, axisB }` ou `null` si aucune tension exploitable / plafond
   * atteint / IA indisponible — le frontend enchaîne alors directement sur
   * `next-batch` (skip silencieux).
   */
  @Post(':sessionId/next-batch/probe')
  async nextBatchProbe(@Param('sessionId') sessionId: string) {
    // Enveloppé dans { probe } pour garantir un corps JSON non vide même quand
    // il n'y a pas de question (le client fait res.json() sans tolérer le vide).
    const probe = await this.questionnaire.generateNextBatchProbe(sessionId);
    return { probe };
  }

  /**
   * GET /v1/questionnaire/:sessionId/results?email=xxx
   *
   * Restaure les résultats d'une session depuis la DB via un lien email.
   * L'email est obligatoire et doit correspondre à celui enregistré en session
   * (vérification anti-partage de lien).
   *
   * Cas d'erreur :
   *   400 — email incorrect / session sans email / session expirée
   *   404 — session introuvable
   */
  @Get(':sessionId/results')
  restore(
    @Param('sessionId') sessionId: string,
    @Query() query: RestoreSessionDto,
  ) {
    return this.questionnaire.restoreSession(sessionId, query.email);
  }
}
