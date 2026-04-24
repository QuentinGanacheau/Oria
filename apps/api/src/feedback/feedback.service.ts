import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateFeedbackDto) {
    return this.prisma.feedbackEvent.create({
      data: {
        sessionId: dto.sessionId,
        eventType: dto.eventType,
        rating: dto.rating,
        selectedJob: dto.selectedJob,
        payload: dto.payload
          ? (dto.payload as Prisma.InputJsonValue)
          : ({} as Prisma.InputJsonValue),
      },
    });
  }
}
