import { Body, Controller, Post } from '@nestjs/common';
import { AnswerNextDto } from './dto/answer-next.dto';
import { FinishSessionDto } from './dto/finish-session.dto';
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
}
