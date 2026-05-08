import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AnswerNextDto } from './dto/answer-next.dto';
import { FinishSessionDto } from './dto/finish-session.dto';
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
