import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  list() {
    return this.jobs.findAll();
  }

  /**
   * Retourne la fiche personnalisée pour un couple (session, métier).
   * La génération est lazy : le premier appel déclenche l'IA,
   * les suivants servent le cache DB (0 coût IA).
   *
   * Query param `sessionId` obligatoire — sans lui on ne peut pas
   * identifier l'utilisateur ni générer une fiche personnalisée.
   */
  @Get(':slug/sheet')
  async getPersonalizedSheet(
    @Param('slug') slug: string,
    @Query('sessionId') sessionId: string | undefined,
  ) {
    if (!sessionId?.trim()) {
      throw new BadRequestException('sessionId est requis.');
    }
    const content = await this.jobs.getPersonalizedSheet(slug, sessionId.trim());
    return { content };
  }

  // La route générique doit être APRÈS les routes spécifiques (:slug/sheet)
  // pour éviter que NestJS interprète "sheet" comme un slug.
  @Get(':slug')
  getOne(@Param('slug') slug: string) {
    return this.jobs.findBySlug(slug);
  }
}
