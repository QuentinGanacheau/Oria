import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createAiProvider } from './providers/ai-provider.factory';
import type { AiProvider } from './providers/ai-provider.interface';
import { TRACK_INSTRUCTIONS, type UserContext } from './user-context';

type SelectionInput = {
  candidateKeys: string[];
  answers: Array<{ question: string; option: string }>;
};

type ScoreAdjustmentInput = {
  topJobs: Array<{ slug: string; score: number }>;
  answers: Array<{ question: string; option: string }>;
};

type TextExtractionInput = {
  question: string;
  text: string;
  jobSlugs: string[];
};

export type RationaleInput = {
  /** Top métiers pour lesquels générer une explication (3 max recommandé). */
  topJobs: Array<{ slug: string; title: string }>;
  /** Toutes les réponses de la session : texte de la question + valeur (label option ou texte libre). */
  answers: Array<{ question: string; answer: string }>;
  /** Contexte utilisateur pour adapter le ton et l'angle d'analyse. */
  userContext?: UserContext;
};

/**
 * Contenu d'une fiche métier personnalisée.
 * Chaque champ est une string prête à afficher (pas de markdown complexe).
 */
export type PersonalizedSheetContent = {
  /** Ce qui va plaire à cet utilisateur dans ce métier (2-3 phrases). */
  strengths: string;
  /** Points de vigilance honnêtes pour son profil (1-2 phrases). */
  watchPoints: string;
  /** 3 prochaines étapes concrètes adaptées à sa situation. */
  nextSteps: string[];
  /** Description narrative d'une journée type (2-3 phrases). */
  dayInLife: string;
};

export type PersonalizedSheetInput = {
  job: { title: string; summary: string; missions: string[]; skills: string[] };
  answers: Array<{ question: string; answer: string }>;
  /** Rang du métier dans le classement (1 = meilleur match). */
  rank: number;
  /** Situation de l'utilisateur : lycee | etudes_longues | reconversion | actif */
  situation: string;
};

/**
 * Service d'IA métier. Il est responsable de :
 *  - construire les prompts spécifiques à chaque cas d'usage,
 *  - appeler un provider (OpenAI / Anthropic / Gemini) de manière uniforme,
 *  - parser et valider les réponses JSON,
 *  - dégrader proprement (return null) en cas d'erreur ou d'absence de provider.
 *
 * L'API publique (chooseQuestion / adjustScores / extractWeightsFromText)
 * est volontairement agnostique du provider : le reste de l'app n'a pas à
 * savoir quelle IA est branchée derrière.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly provider: AiProvider | null;

  constructor(config: ConfigService) {
    this.provider = createAiProvider(config, this.logger);
    if (this.provider) {
      this.logger.log(`IA activée via provider "${this.provider.name}".`);
    } else {
      this.logger.log('IA désactivée (fallback règles).');
    }
  }

  isEnabled(): boolean {
    return this.provider !== null;
  }

  async chooseQuestion(input: SelectionInput): Promise<string | null> {
    if (!this.provider || input.candidateKeys.length === 0) {
      return null;
    }

    const prompt = [
      'Choose exactly one next question key from the allowed list.',
      'Return valid JSON only: {"questionKey":"..."}',
      `Allowed question keys: ${input.candidateKeys.join(', ')}`,
      `User answers so far: ${JSON.stringify(input.answers)}`,
      'Goal: maximize discriminatory power for career matching.',
    ].join('\n');

    const parsed = await this.askJson<{ questionKey?: string }>(prompt);
    if (!parsed?.questionKey) return null;
    return input.candidateKeys.includes(parsed.questionKey)
      ? parsed.questionKey
      : null;
  }

  async adjustScores(
    input: ScoreAdjustmentInput,
  ): Promise<Record<string, number> | null> {
    if (!this.provider || input.topJobs.length === 0) {
      return null;
    }

    const prompt = [
      'Adjust ranking with tiny bounded multipliers only.',
      'Return valid JSON only: {"multipliers":{"job-slug":number}}',
      'Each multiplier must be between 0.9 and 1.1.',
      `Current top jobs: ${JSON.stringify(input.topJobs)}`,
      `User answers: ${JSON.stringify(input.answers)}`,
    ].join('\n');

    const parsed = await this.askJson<{ multipliers?: Record<string, number> }>(
      prompt,
    );
    if (!parsed?.multipliers) return null;

    // Clamp défensif : même si l'IA ignore les bornes, on sécurise côté code.
    const safe: Record<string, number> = {};
    for (const [slug, value] of Object.entries(parsed.multipliers)) {
      if (typeof value !== 'number' || Number.isNaN(value)) continue;
      safe[slug] = Math.max(0.9, Math.min(1.1, value));
    }
    return safe;
  }

  /**
   * Convertit un texte libre en poids métier (0-5 par slug) pour alimenter
   * le scoring au même format que les options QCM. Retourne null si l'IA
   * n'est pas disponible ou si le texte est trop court.
   */
  async extractWeightsFromText(
    input: TextExtractionInput,
  ): Promise<Record<string, number> | null> {
    if (!this.provider || input.text.trim().length < 3) {
      return null;
    }

    const prompt = [
      "Tu es un expert en orientation professionnelle.",
      "À partir de la réponse libre d'un utilisateur à une question, évalue à quel point chaque métier lui correspond.",
      '',
      `Question posée : "${input.question}"`,
      `Réponse de l'utilisateur : "${input.text}"`,
      '',
      `Métiers candidats (slugs) : ${input.jobSlugs.join(', ')}`,
      '',
      'Règles :',
      '- Retourne UNIQUEMENT du JSON valide au format {"weights":{"slug":number}}.',
      '- Chaque poids est un entier entre 0 (aucun signal) et 5 (signal très fort).',
      '- Ne mets un poids > 0 que si la réponse contient un signal clair pour ce métier.',
      "- N'invente pas de signal : si la réponse est vague, retourne {} ou des poids faibles.",
      '- Liste uniquement les slugs fournis ci-dessus.',
    ].join('\n');

    const parsed = await this.askJson<{ weights?: Record<string, number> }>(
      prompt,
      0.2,
    );
    if (!parsed?.weights) return null;

    const safe: Record<string, number> = {};
    for (const [slug, value] of Object.entries(parsed.weights)) {
      if (!input.jobSlugs.includes(slug)) continue;
      if (typeof value !== 'number' || Number.isNaN(value)) continue;
      safe[slug] = Math.max(0, Math.min(5, Math.round(value)));
    }
    return safe;
  }

  /**
   * Génère une explication personnalisée pour chaque métier du top.
   *
   * Un seul appel IA pour tous les métiers (pas N appels) afin de limiter
   * la latence et le coût. La température est légèrement plus élevée (0.4)
   * pour obtenir un texte fluide et naturel plutôt qu'un résumé mécanique.
   *
   * Retourne null si l'IA est indisponible — l'appelant affiche simplement
   * le résultat sans explication, sans erreur.
   */
  async generateRationales(
    input: RationaleInput,
  ): Promise<Record<string, string> | null> {
    if (!this.provider || input.topJobs.length === 0) return null;

    // On formate les réponses en les distinguant : QCM court vs texte libre long
    const answersBlock = input.answers
      .map((a) => `- "${a.question}" → ${a.answer}`)
      .join('\n');

    const jobsBlock = input.topJobs
      .map((j) => `- ${j.slug} (${j.title})`)
      .join('\n');

    const trackInstruction = input.userContext
      ? TRACK_INSTRUCTIONS[input.userContext.track]
      : TRACK_INSTRUCTIONS.professional;

    const prompt = [
      "Tu es un conseiller d'orientation bienveillant et direct.",
      trackInstruction,
      '',
      "Voici les réponses de l'utilisateur à un questionnaire d'orientation :",
      '',
      answersBlock,
      '',
      "Ces métiers ont été identifiés comme correspondant à son profil :",
      jobsBlock,
      '',
      'Pour chacun de ces métiers, rédige UNE explication personnalisée de 2 à 3 phrases.',
      "L'explication doit :",
      "- S'adresser directement à l'utilisateur (tutoyer, ton chaleureux).",
      "- Citer explicitement 1 ou 2 éléments précis de SES réponses pour justifier le match.",
      "- Mentionner honnêtement 1 point de vigilance si pertinent (sans dramatiser).",
      '',
      'Retourne UNIQUEMENT du JSON valide : {"rationales": {"slug": "explication..."}}',
      "N'ajoute rien d'autre autour du JSON.",
    ].join('\n');

    const parsed = await this.askJson<{
      rationales?: Record<string, string>;
    }>(prompt, 0.4);

    if (!parsed?.rationales) return null;

    // Validation : on garde seulement les slugs attendus et les strings non vides
    const safe: Record<string, string> = {};
    for (const job of input.topJobs) {
      const text = parsed.rationales[job.slug];
      if (typeof text === 'string' && text.trim().length > 0) {
        safe[job.slug] = text.trim();
      }
    }
    return Object.keys(safe).length > 0 ? safe : null;
  }

  /**
   * Génère une fiche métier entièrement personnalisée pour un utilisateur donné.
   *
   * Appelée à la demande (lazy) depuis l'endpoint GET /v1/jobs/:slug/sheet.
   * Le résultat est mis en cache dans MatchResult.personalizedContent : cette
   * méthode n'est donc jamais appelée deux fois pour le même couple (session, métier).
   *
   * Température 0.4 : plus narrative que les méthodes fonctionnelles, tout en
   * restant cohérente entre deux appels sur un même profil.
   */
  async generatePersonalizedSheet(
    input: PersonalizedSheetInput,
  ): Promise<PersonalizedSheetContent | null> {
    if (!this.provider) return null;

    const situationLabel: Record<string, string> = {
      lycee: 'lycéen / étudiant en cursus court',
      etudes_longues: 'étudiant en études longues (Bac+3 et plus)',
      reconversion: 'en reconversion professionnelle',
      actif: 'déjà en poste et en exploration',
    };
    const situationText = situationLabel[input.situation] ?? input.situation;

    const answersBlock = input.answers
      .map((a) => `- "${a.question}" → ${a.answer}`)
      .join('\n');

    const prompt = [
      "Tu es un conseiller d'orientation expert, bienveillant et direct.",
      `Tu analyses le profil d'un utilisateur (${situationText}) pour le métier "${input.job.title}".`,
      '',
      "Réponses de l'utilisateur au questionnaire :",
      answersBlock,
      '',
      `Métier analysé : ${input.job.title}`,
      `Description : ${input.job.summary}`,
      `Missions : ${input.job.missions.join(', ')}`,
      `Compétences clés : ${input.job.skills.join(', ')}`,
      `Rang dans son classement : #${input.rank}`,
      '',
      'Génère une analyse personnalisée en JSON strict (sans markdown autour) :',
      '{',
      '  "strengths": "2-3 phrases sur ce qui va lui plaire dans CE métier, en citant des éléments précis de SES réponses. Tutoie-le.",',
      '  "watchPoints": "1-2 phrases honnêtes sur les points de vigilance pour SON profil spécifique. Pas de catastrophisme.",',
      '  "nextSteps": ["étape 1 concrète et actionnée pour sa situation", "étape 2", "étape 3"],',
      '  "dayInLife": "2-3 phrases décrivant une journée type dans ce métier, rédigées comme si on lui parlait directement."',
      '}',
      '',
      "Règles : tutoie toujours. Cite des éléments précis de ses réponses. N'invente pas de détails absents de son profil.",
    ].join('\n');

    const parsed = await this.askJson<Partial<PersonalizedSheetContent>>(
      prompt,
      0.4,
    );
    if (!parsed) return null;

    // Validation défensive : chaque champ doit être présent et du bon type
    const { strengths, watchPoints, nextSteps, dayInLife } = parsed;
    if (
      typeof strengths !== 'string' || strengths.trim().length === 0 ||
      typeof watchPoints !== 'string' || watchPoints.trim().length === 0 ||
      !Array.isArray(nextSteps) || nextSteps.length === 0 ||
      typeof dayInLife !== 'string' || dayInLife.trim().length === 0
    ) {
      this.logger.warn('generatePersonalizedSheet: réponse IA incomplète ou malformée.');
      return null;
    }

    return {
      strengths: strengths.trim(),
      watchPoints: watchPoints.trim(),
      nextSteps: nextSteps
        .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
        .slice(0, 3),
      dayInLife: dayInLife.trim(),
    };
  }

  /**
   * Reranke une liste de métiers candidats selon le profil utilisateur.
   *
   * Utilisé par le pipeline de matching ROME (Phase 2) pour sélectionner
   * les meilleurs métiers parmi les ~100-300 candidats des top domaines.
   *
   * Un seul appel IA pour toute la liste, même format de retour qu'un
   * scoring classique : { code: score 0-100 }. Température basse (0.2)
   * car on attend de la cohérence, pas de la créativité.
   *
   * Retourne null si l'IA est indisponible — l'appelant gère le fallback.
   */
  async rankJobsForProfile(input: {
    candidates: Array<{ code: string; libelle: string }>;
    answers: Array<{ question: string; answer: string }>;
    userContext?: UserContext;
  }): Promise<Record<string, number> | null> {
    if (!this.provider || input.candidates.length === 0) return null;

    const candidatesBlock = input.candidates
      .map((c) => `${c.code}: ${c.libelle}`)
      .join('\n');

    const answersBlock = input.answers
      .map((a) => `- "${a.question}" → ${a.answer}`)
      .join('\n');

    const trackInstruction = input.userContext
      ? TRACK_INSTRUCTIONS[input.userContext.track]
      : TRACK_INSTRUCTIONS.professional;

    const prompt = [
      "Tu es un conseiller d'orientation expert.",
      trackInstruction,
      '',
      "Voici les réponses de l'utilisateur à un questionnaire d'orientation :",
      '',
      answersBlock,
      '',
      'Voici une liste de métiers candidats (format "code: libellé") :',
      '',
      candidatesBlock,
      '',
      'Pour CHAQUE métier de la liste, attribue un score de 0 à 100 reflétant',
      "à quel point ce métier correspond au profil de l'utilisateur :",
      '- 0 = aucune correspondance',
      '- 50 = correspondance correcte mais sans plus',
      '- 100 = match exceptionnel',
      '',
      'Règles strictes :',
      "- N'invente pas de codes : utilise uniquement ceux fournis ci-dessus.",
      '- Sois discriminant : seuls 5-10 métiers méritent un score > 70.',
      '- Retourne UNIQUEMENT du JSON valide au format :',
      '  {"scores": {"M1805": 85, "J1502": 12, ...}}',
    ].join('\n');

    const parsed = await this.askJson<{ scores?: Record<string, number> }>(
      prompt,
      0.2,
    );
    if (!parsed?.scores) return null;

    // Validation défensive : on garde uniquement les codes connus + valeurs
    // numériques bornées dans [0, 100].
    const validCodes = new Set(input.candidates.map((c) => c.code));
    const safe: Record<string, number> = {};
    for (const [code, value] of Object.entries(parsed.scores)) {
      if (!validCodes.has(code)) continue;
      if (typeof value !== 'number' || Number.isNaN(value)) continue;
      safe[code] = Math.max(0, Math.min(100, Math.round(value)));
    }

    return Object.keys(safe).length > 0 ? safe : null;
  }

  /**
   * Helper privé : appelle le provider, nettoie le JSON (certains modèles
   * entourent leur réponse de blocs markdown ```json ... ```), parse,
   * renvoie `null` sur toute erreur (indisponibilité, JSON invalide…).
   *
   * Centralise la gestion d'erreur pour que chaque méthode publique reste
   * concise et symétrique.
   */
  private async askJson<T>(
    prompt: string,
    temperature = 0.1,
  ): Promise<T | null> {
    if (!this.provider) return null;
    try {
      const raw = await this.provider.complete({ prompt, temperature });
      const cleaned = stripCodeFences(raw);
      if (!cleaned) return null;
      return JSON.parse(cleaned) as T;
    } catch (error) {
      this.logger.warn(
        `Appel IA (${this.provider.name}) en échec : ${(error as Error).message}`,
      );
      return null;
    }
  }
}

/**
 * Gemini et Claude ont tendance à encapsuler leur JSON dans un bloc de code
 * Markdown (```json ... ```) malgré la consigne. On le retire avant parsing.
 */
function stripCodeFences(raw: string): string {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return fence ? fence[1].trim() : trimmed;
}
