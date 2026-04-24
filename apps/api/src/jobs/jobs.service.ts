import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AiService, type PersonalizedSheetContent, type PersonalizedSheetInput } from '../ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { JOBS } from './jobs.data';
import type { JobProfile, JobSlug } from './job.types';

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  findAll(): JobProfile[] {
    return JOBS;
  }

  findBySlug(slug: string): JobProfile {
    const job = JOBS.find((j) => j.slug === slug);
    if (!job) {
      throw new NotFoundException(`Métier introuvable : ${slug}`);
    }
    return job;
  }

  isValidSlug(slug: string): slug is JobSlug {
    return JOBS.some((j) => j.slug === slug);
  }

  listSlugs(): JobSlug[] {
    return JOBS.map((j) => j.slug);
  }

  /**
   * Retourne la fiche personnalisée pour un couple (session, métier).
   *
   * Pattern cache-aside :
   *  - Cache hit  → retour immédiat depuis MatchResult.personalizedContent (0 appel IA)
   *  - Cache miss → génération IA → stockage → retour
   *  - IA indisponible ou échec → retourne null (dégradation propre, page statique)
   */
  async getPersonalizedSheet(
    slug: string,
    sessionId: string,
  ): Promise<PersonalizedSheetContent | null> {
    // 1. Vérifier que le métier existe
    const job = this.findBySlug(slug); // lève NotFoundException si inconnu

    // 2. Chercher le MatchResult correspondant (session + métier)
    const matchResult = await this.prisma.matchResult.findFirst({
      where: { sessionId, jobSlug: slug },
    });

    // Pas de match = session inconnue ou métier non classé pour cette session
    if (!matchResult) return null;

    // 3. Cache hit — la fiche a déjà été générée
    if (matchResult.personalizedContent !== null) {
      return matchResult.personalizedContent as PersonalizedSheetContent;
    }

    // 4. Cache miss — charger les réponses de la session pour préparer l'input IA
    const answers = await this.prisma.sessionAnswer.findMany({
      where: { sessionId },
      include: { question: true, option: true },
    });

    if (answers.length === 0) return null;

    // Extraire la situation de l'utilisateur (réponse à la question "situation")
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

    // 5. Génération IA
    const content = await this.ai.generatePersonalizedSheet(input);

    // 6. Mise en cache en base (même si null, pour éviter des appels répétés inutiles)
    //    On ne stocke que si le contenu est valide — null = on réessaiera à la prochaine visite.
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
}
