import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MOCK_PERSONALIZED_SHEET,
  MOCK_PORTRAITS,
  MOCK_RANK_WITH_PREFERENCES,
  mockRationale,
} from './ai.mock';
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
  /** Plan d'action concret (Phase 5) — null si IA indisponible. */
  actionPlan?: ActionPlan | null;
};

/** Formation accessible pour un étudiant. */
export type StudentFormation = {
  name: string;
  duration: string;
  cost: string;
};

/** Formation CPF pour un professionnel en reconversion. */
export type CpfFormation = {
  name: string;
  duration: string;
  cpfEligible: boolean;
};

/** Plan d'action track étudiant. */
export type ActionPlanStudent = {
  track: 'student';
  /** 2-3 formations concrètes (BTS, Licence Pro, Master…) avec durée et coût estimé. */
  formations: StudentFormation[];
  /** Parcours type du lycée/études au métier visé. Ex: "Bac → DUT Info (2 ans) → Licence Pro (1 an)". */
  typicalPath: string;
  /** 3 actions très concrètes à faire dans les 7 prochains jours. */
  thisWeek: string[];
};

/** Plan d'action track professionnel / reconversion. */
export type ActionPlanProfessional = {
  track: 'professional';
  /** Compétences transférables déjà acquises vs compétences à développer. */
  skillsDelta: { already: string[]; missing: string[] };
  /** 1-2 formations accessibles via CPF ou dispositifs de reconversion. */
  cpfFormations: CpfFormation[];
  /** Fourchette de salaire de départ réaliste pour ce métier en reconversion. */
  salaryHint: string;
  /** Jalons concrets sur 3 horizons temporels. */
  timeline: { sixMonths: string; oneYear: string; twoYears: string };
};

export type ActionPlan = ActionPlanStudent | ActionPlanProfessional;

export type PersonalizedSheetInput = {
  job: { title: string; summary: string; missions: string[]; skills: string[] };
  answers: Array<{ question: string; answer: string }>;
  /** Rang du métier dans le classement (1 = meilleur match). */
  rank: number;
  /** Situation de l'utilisateur : lycee | etudes_longues | reconversion | actif */
  situation: string;
  /**
   * Contexte track — permet d'adapter le ton et l'angle d'analyse.
   * Optionnel : si absent, le track 'professional' est utilisé par défaut.
   */
  userContext?: UserContext;
};

/**
 * Portrait personnalisé de l'utilisateur (Phase 2 produit).
 *
 * Affiché entre la fin du questionnaire et les résultats pour créer un moment
 * de reconnaissance. Adapté au track : ton enthousiaste pour les étudiants,
 * ancré pour les professionnels.
 */
export type PortraitContent = {
  /** Archétype évocateur, format "Le/La [adj] [nom]". Ex: "L'Architecte du lien". */
  archetype: string;
  /** 2-3 phrases qui décrivent qui est l'utilisateur, citant ses réponses. */
  summary: string;
  /** 3 forces naturelles, 2-4 mots chacune. */
  strengths: string[];
  /** Ce qui le/la fait vibrer (1 phrase). */
  thrives: string;
  /** Ce qui le/la viderait (1 phrase honnête, sans dramatisation). */
  drains: string;
};

export type PortraitInput = {
  answers: Array<{ question: string; answer: string }>;
  userContext: UserContext;
};

export type RefinedJobInput = {
  /** Métier aimé (👍). */
  code: string;
  libelle: string;
};

export type DislikedJobInput = {
  /** Métier rejeté (👎). */
  code: string;
  libelle: string;
  /** Raison optionnelle fournie par l'utilisateur. */
  reason?: string | null;
};

export type RankWithPreferencesInput = {
  candidates: Array<{ code: string; libelle: string }>;
  answers: Array<{ question: string; answer: string }>;
  likedJobs: RefinedJobInput[];
  dislikedJobs: DislikedJobInput[];
  userContext: UserContext;
};

export type RankWithPreferencesResult = {
  /** Score 0-100 par code ROME. */
  scores: Record<string, number>;
  /**
   * Phrase générée par l'IA expliquant ce que les notes révèlent sur le profil.
   * Ex: "Tu apprécies les métiers qui combinent création et impact concret."
   */
  insight: string;
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
  /**
   * Mode mock développement : retourne des données factices à la place
   * des vrais appels IA. Activé via DEV_MOCK_AI=true dans le .env.
   * ⚠️ Ne jamais activer en production.
   */
  private readonly mockMode: boolean;

  constructor(config: ConfigService) {
    this.mockMode = config.get<string>('DEV_MOCK_AI') === 'true';
    this.provider = createAiProvider(config, this.logger);

    if (this.mockMode) {
      this.logger.warn(
        '⚠️  DEV_MOCK_AI=true — les appels IA sont simulés avec des données factices. ' +
          'Ne jamais utiliser en production.',
      );
    } else if (this.provider) {
      this.logger.log(`IA activée via provider "${this.provider.name}".`);
    } else {
      this.logger.log('IA désactivée (fallback règles).');
    }
  }

  isEnabled(): boolean {
    return this.mockMode || this.provider !== null;
  }

  async chooseQuestion(input: SelectionInput): Promise<string | null> {
    // En mode mock on retourne null → fallback sur shortlist[0] (comportement normal)
    if (this.mockMode) return null;
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
    if (this.mockMode) {
      const rationales: Record<string, string> = {};
      input.topJobs.forEach((job, i) => {
        rationales[job.slug] = mockRationale(job, i);
      });
      return rationales;
    }
    if (!this.provider || input.topJobs.length === 0) return null;

    // On formate les réponses en les distinguant : QCM court vs texte libre long
    const answersBlock = input.answers
      .map((a) => `- "${a.question}" → ${a.answer}`)
      .join('\n');

    const jobsBlock = input.topJobs
      .map((j) => `- ${j.slug} (${j.title})`)
      .join('\n');

    const track = input.userContext?.track ?? 'professional';

    // Instructions d'angle spécifiques au track.
    // L'étudiant n'a pas d'expérience à valoriser → on parle de ses passions et potentiel.
    // Le professionnel a un parcours → on parle de la continuité et des compétences transférables.
    const rationaleAngle =
      track === 'student'
        ? [
            "Pour justifier le match, appuie-toi sur ses passions, son style d'apprentissage",
            "et ses textes libres (métier imaginé, journée idéale).",
            "Montre comment CE métier peut nourrir ce qui l'anime.",
          ].join(' ')
        : [
            "Pour justifier le match, appuie-toi sur son expérience actuelle :",
            "ce qu'il fait, ce qu'il garde, les compétences pour lesquelles on vient le voir.",
            "Montre la continuité entre son parcours et ce métier.",
          ].join(' ');

    const prompt = [
      "Tu es un conseiller d'orientation direct et honnête.",
      rationaleAngle,
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
      "- S'adresser directement à l'utilisateur (tutoyer).",
      "- Citer 1 ou 2 éléments CONCRETS et PRÉCIS de SES réponses (pas de généralités).",
      "- Terminer par 1 point de vigilance HONNÊTE et spécifique — toujours, même si le match est fort.",
      "  (ex: si ses irritants sont présents dans ce métier, nomme-les ; si la formation est longue, dis-le)",
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
    if (this.mockMode) {
      return MOCK_PERSONALIZED_SHEET[
        input.userContext?.track ?? 'professional'
      ];
    }
    if (!this.provider) return null;

    const track = input.userContext?.track ?? 'professional';

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

    // ── Instructions track-spécifiques ────────────────────────────────────
    // Chaque champ du JSON a des instructions différentes selon le profil.
    // L'étudiant a besoin de voir son potentiel et le chemin à construire.
    // Le professionnel a besoin de voir la continuité avec ce qu'il a déjà.

    const strengthsInstruction =
      track === 'student'
        ? [
            '"strengths": "2-3 phrases montrant comment CE métier peut nourrir ses passions',
            'et son style naturel. Cite au moins un élément concret de ses textes libres',
            '(ce qui le fascine, le métier imaginé, la journée idéale).',
            'Montre le chemin, pas juste la destination. Tutoie."',
          ].join(' ')
        : [
            '"strengths": "2-3 phrases montrant quelles compétences de son parcours actuel',
            '(citées dans ses réponses : ce qu\'il fait, ce qu\'il garde, pour quoi on vient le voir)',
            'sont DIRECTEMENT réutilisables dans ce métier.',
            'Rends tangible la continuité. Tutoie."',
          ].join(' ');

    const watchPointsInstruction = [
      '"watchPoints": "1-2 phrases franchement honnêtes.',
      'Règle absolue : si ses irritants (ce qui le fatigue, ce qu\'il fuit) sont présents',
      'dans ce métier, NOMME-LES explicitement.',
      track === 'professional'
        ? 'Si sa contrainte de salaire ou de formation est en tension avec ce métier, dis-le.'
        : 'Si le chemin vers ce métier nécessite une formation longue que ça ne lui convient pas, dis-le.',
      'Une phrase précise et honnête vaut mieux qu\'un vague \\"fais attention\\".',
      'Pas de catastrophisme, mais pas de diplomatie inutile non plus."',
    ].join(' ');

    const nextStepsInstruction =
      track === 'student'
        ? [
            '"nextSteps": [',
            '"étape 1 : explorer le terrain concrètement (ex: parler à quelqu\'un qui fait ce métier, shadow day, forum)",',
            '"étape 2 : tester ses aptitudes sans s\'engager (projet perso, stage, association, MOOC ciblé)",',
            '"étape 3 : identifier le parcours de formation le plus direct vers ce métier"',
            ']',
          ].join(' ')
        : [
            '"nextSteps": [',
            '"étape 1 : valider le terrain sans quitter son job (entretien informel avec un pro du secteur, LinkedIn)",',
            '"étape 2 : identifier son gap de compétences et trouver 1 ressource précise pour le combler",',
            '"étape 3 : tester à petite échelle (freelance, mission ponctuelle, projet pilote)"',
            ']',
          ].join(' ');

    // ── Plan d'action (Phase 5) — instructions track-spécifiques ────────────
    const actionPlanInstruction =
      track === 'student'
        ? [
            '"actionPlan": {',
            '  "track": "student",',
            '  "formations": [',
            '    { "name": "Nom de la formation (BTS, Licence Pro, BUT, Master…)", "duration": "Durée réaliste (ex: 2 ans)", "cost": "Coût estimé (ex: gratuit en apprentissage, 5 000 €/an en école privée)" },',
            '    /* 1 à 2 autres formations alternatives pertinentes */',
            '  ],',
            '  "typicalPath": "Parcours type du lycée/études jusqu\'à ce métier. Ex: Bac → DUT (2 ans) → Licence Pro (1 an) → entrée dans le métier.",',
            '  "thisWeek": [',
            '    "Action très concrète à faire dans les 7 prochains jours (ex: trouver 2 personnes sur LinkedIn qui font ce métier et les contacter)",',
            '    "Action concrète 2 (ex: regarder 3 témoignages vidéo de professionnels sur YouTube)",',
            '    "Action concrète 3 (ex: visiter le site de l\'école X et regarder les conditions d\'admission)"',
            '  ]',
            '}',
          ].join('\n  ')
        : [
            '"actionPlan": {',
            '  "track": "professional",',
            '  "skillsDelta": {',
            '    "already": ["compétence 1 qu\'il a déjà d\'après ses réponses", "compétence 2", "compétence 3"],',
            '    "missing": ["compétence manquante 1 pour ce métier", "compétence manquante 2"]',
            '  },',
            '  "cpfFormations": [',
            '    { "name": "Nom de la formation CPF ou dispositif reconversion", "duration": "Durée (ex: 3 mois)", "cpfEligible": true },',
            '    { "name": "Alternative formation", "duration": "Durée", "cpfEligible": false }',
            '  ],',
            '  "salaryHint": "Fourchette de salaire de départ réaliste en reconversion pour ce métier (ex: Entre 28 000 € et 35 000 € brut/an pour un débutant reconverti).",',
            '  "timeline": {',
            '    "sixMonths": "Objectif concret à 6 mois : ce qui est réaliste de valider ou tester en demi-année.",',
            '    "oneYear": "Objectif à 1 an : cap réaliste si démarrage maintenant.",',
            '    "twoYears": "Objectif à 2 ans : où il peut raisonnablement être si il engage la démarche aujourd\'hui."',
            '  }',
            '}',
          ].join('\n  ');

    const prompt = [
      "Tu es un conseiller d'orientation expert, direct et honnête.",
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
      `  ${strengthsInstruction},`,
      `  ${watchPointsInstruction},`,
      `  ${nextStepsInstruction},`,
      '  "dayInLife": "2-3 phrases réalistes décrivant une journée type dans ce métier.',
      '   Concret, incarné, sans jargon. Rédigé comme si on lui parlait directement.",',
      `  ${actionPlanInstruction}`,
      '}',
      '',
      "Règles absolues :",
      "- Tutoie toujours.",
      "- Cite des éléments CONCRETS et PRÉCIS de ses réponses (pas de généralités).",
      "- watchPoints : au moins un point honnête, même si le match est bon.",
      "- N'invente aucun détail absent du profil.",
      "- actionPlan : base les formations et compétences sur la réalité du métier et du profil, pas des généralités.",
      track === 'student'
        ? "- formations : privilégie les voies publiques accessibles (BTS, IUT, Licence Pro) avant les écoles privées coûteuses."
        : "- skillsDelta : identifie les compétences depuis ses réponses réelles (ce qu'il fait, ce qu'il garde, pour quoi on vient le voir).",
    ].join('\n');

    const parsed = await this.askJson<Partial<PersonalizedSheetContent>>(
      prompt,
      0.4,
    );
    if (!parsed) return null;

    // Validation défensive : chaque champ obligatoire doit être présent
    const { strengths, watchPoints, nextSteps, dayInLife, actionPlan } = parsed;
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
      // actionPlan est optionnel : null si absent ou malformé (dégradation propre)
      actionPlan: validateActionPlan(actionPlan, track) ?? null,
    };
  }

  /**
   * Génère un portrait personnalisé de l'utilisateur (Phase 2 produit).
   *
   * Le portrait s'affiche entre la fin du questionnaire et les résultats
   * pour créer un moment de reconnaissance ("c'est moi !"). Cette confiance
   * améliore la perception des métiers recommandés ensuite.
   *
   * Génération unique par session — appelée depuis `finishSession` en parallèle
   * avec `generateRationales` pour ne pas allonger la latence totale.
   * Le résultat est persisté dans `QuestionnaireSession.portrait`.
   *
   * Température 0.5 : il faut de la créativité pour l'archétype et le ton,
   * sans aller jusqu'à l'incohérence.
   *
   * Retourne null si l'IA est indisponible ou si la réponse est malformée :
   * le frontend skippe alors silencieusement l'écran portrait.
   */
  async generatePortrait(
    input: PortraitInput,
  ): Promise<PortraitContent | null> {
    if (this.mockMode) return MOCK_PORTRAITS[input.userContext.track];
    if (!this.provider || input.answers.length === 0) return null;

    const answersBlock = input.answers
      .map((a) => `- "${a.question}" → ${a.answer}`)
      .join('\n');

    // Instructions de tonalité spécifiques au track. Le portrait d'un étudiant
    // doit valoriser son potentiel ; celui d'un professionnel doit s'ancrer
    // dans son expérience vécue.
    const trackTone =
      input.userContext.track === 'student'
        ? [
            "L'utilisateur est étudiant ou en début de parcours.",
            "Concentre-toi sur ses passions, son potentiel et la trajectoire qu'il pourrait construire.",
            "Ton enthousiaste et tourné vers l'avenir, sans être naïf.",
          ].join(' ')
        : [
            "L'utilisateur est en poste ou en reconversion active, avec une expérience à valoriser.",
            "Identifie ce qui ressort de son parcours réel : compétences acquises, ce qui le porte, ce qui l'a usé.",
            "Ton ancré, mature, qui reconnaît ce qu'il a déjà vécu.",
          ].join(' ');

    const prompt = [
      'Tu es un coach en orientation expert en lecture de profils.',
      trackTone,
      '',
      "Voici les réponses de l'utilisateur au questionnaire :",
      answersBlock,
      '',
      "Génère un portrait personnalisé en JSON strict (sans markdown autour) :",
      '{',
      '  "archetype": "Un titre évocateur, format \\"L\'Architecte du lien\\" ou \\"Le Stratège curieux\\". Original, jamais générique (PAS \\"Le Leader\\" ou \\"Le Créatif\\").",',
      '  "summary": "2 à 3 phrases qui décrivent qui il/elle est, en citant explicitement 1 ou 2 éléments précis de SES réponses. Tutoie.",',
      '  "strengths": ["force 1 (2-4 mots)", "force 2 (2-4 mots)", "force 3 (2-4 mots)"],',
      '  "thrives": "Une phrase sur ce qui le/la fait vibrer (issu de ses réponses positives).",',
      '  "drains": "Une phrase honnête sur ce qui le/la viderait (issu de ses irritants ou contraintes). Pas de catastrophisme."',
      '}',
      '',
      'Règles strictes :',
      "- Tutoiement systématique.",
      "- L'archétype DOIT être évocateur et spécifique. Pas de \"Manager\", \"Expert\", \"Créateur\" seuls.",
      "- Cite des éléments concrets des réponses pour que la personne se reconnaisse.",
      "- Forces : 2-4 mots, concrètes (pas \"empathie\" mais \"écoute active\" ; pas \"organisation\" mais \"structuration claire\").",
      "- N'invente AUCUN détail absent du profil.",
    ].join('\n');

    const parsed = await this.askJson<Partial<PortraitContent>>(prompt, 0.5);
    if (!parsed) return null;

    // Validation défensive — chaque champ doit être présent et du bon type
    const { archetype, summary, strengths, thrives, drains } = parsed;
    if (
      typeof archetype !== 'string' || archetype.trim().length === 0 ||
      typeof summary !== 'string' || summary.trim().length === 0 ||
      !Array.isArray(strengths) || strengths.length === 0 ||
      typeof thrives !== 'string' || thrives.trim().length === 0 ||
      typeof drains !== 'string' || drains.trim().length === 0
    ) {
      this.logger.warn('generatePortrait: réponse IA incomplète ou malformée.');
      return null;
    }

    return {
      archetype: archetype.trim(),
      summary: summary.trim(),
      strengths: strengths
        .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
        .map((s) => s.trim())
        .slice(0, 3),
      thrives: thrives.trim(),
      drains: drains.trim(),
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
  /**
   * Reranke des candidats en tenant compte des préférences déclarées (Phase 4).
   *
   * Appelé pour la 2e passe de résultats, après que l'utilisateur ait noté
   * les métiers de la passe 1 (👍/👎/🤔). Les raisons de rejet enrichissent
   * le signal au-delà du simple binaire aimé/pas aimé.
   *
   * Retourne les scores ET un "insight" : phrase expliquant ce que les notes
   * révèlent sur le profil (affiché en tête de la section résultats affinés).
   *
   * Température 0.2 : cohérence prioritaire sur la créativité.
   */
  async rankJobsWithPreferences(
    input: RankWithPreferencesInput,
  ): Promise<RankWithPreferencesResult | null> {
    if (this.mockMode) {
      return MOCK_RANK_WITH_PREFERENCES(input);
    }
    if (!this.provider || input.candidates.length === 0) return null;

    const answersBlock = input.answers
      .map((a) => `- "${a.question}" → ${a.answer}`)
      .join('\n');

    const likedBlock =
      input.likedJobs.length > 0
        ? input.likedJobs.map((j) => `  ✅ ${j.code}: ${j.libelle}`).join('\n')
        : '  (aucun métier aimé)';

    const dislikedBlock =
      input.dislikedJobs.length > 0
        ? input.dislikedJobs
            .map((j) => {
              const reason = j.reason ? ` → raison : "${j.reason}"` : '';
              return `  ❌ ${j.code}: ${j.libelle}${reason}`;
            })
            .join('\n')
        : '  (aucun métier rejeté)';

    const candidatesBlock = input.candidates
      .map((c) => `${c.code}: ${c.libelle}`)
      .join('\n');

    const trackInstruction = TRACK_INSTRUCTIONS[input.userContext.track];

    const prompt = [
      "Tu es un conseiller d'orientation expert.",
      trackInstruction,
      '',
      "Voici les réponses de l'utilisateur au questionnaire :",
      answersBlock,
      '',
      "L'utilisateur a évalué ses premiers résultats :",
      "Métiers appréciés :",
      likedBlock,
      "Métiers rejetés :",
      dislikedBlock,
      '',
      'Voici de nouveaux candidats à reranker (format "code: libellé") :',
      candidatesBlock,
      '',
      'Ta mission :',
      '1. Attribue un score 0-100 à chaque candidat.',
      '   Favorise les métiers similaires aux aimés.',
      '   Pénalise les métiers similaires aux rejetés (surtout si une raison est donnée).',
      '2. Génère un "insight" : UNE phrase qui résume ce que les notes révèlent sur le profil.',
      '   Ex: "Tu apprécies les métiers qui combinent structure et créativité."',
      '   (Pas de "d\'après tes notes" — parle directement à la personne, tutoie.)',
      '',
      'Retourne UNIQUEMENT du JSON valide :',
      '{"scores": {"M1805": 85, ...}, "insight": "..."}',
    ].join('\n');

    const parsed = await this.askJson<{
      scores?: Record<string, number>;
      insight?: string;
    }>(prompt, 0.2);

    if (!parsed?.scores || !parsed?.insight) return null;

    const validCodes = new Set(input.candidates.map((c) => c.code));
    const safeScores: Record<string, number> = {};
    for (const [code, value] of Object.entries(parsed.scores)) {
      if (!validCodes.has(code)) continue;
      if (typeof value !== 'number' || Number.isNaN(value)) continue;
      safeScores[code] = Math.max(0, Math.min(100, Math.round(value)));
    }

    return {
      scores: safeScores,
      insight: typeof parsed.insight === 'string' ? parsed.insight.trim() : '',
    };
  }

  async rankJobsForProfile(input: {
    candidates: Array<{ code: string; libelle: string }>;
    answers: Array<{ question: string; answer: string }>;
    userContext?: UserContext;
  }): Promise<Record<string, number> | null> {
    if (this.mockMode) {
      // Donne des scores décroissants : les premiers candidats obtiennent
      // les meilleurs scores pour simuler un reranking cohérent.
      const scores: Record<string, number> = {};
      input.candidates.forEach((c, i) => {
        scores[c.code] = Math.max(15, 90 - i * 5);
      });
      return scores;
    }
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

/**
 * Valide et normalise l'objet actionPlan retourné par l'IA.
 * Retourne null si la structure est absente ou malformée — dégradation propre.
 */
function validateActionPlan(
  raw: unknown,
  track: 'student' | 'professional',
): ActionPlan | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  if (track === 'student') {
    const formations = Array.isArray(obj.formations)
      ? obj.formations
          .filter(
            (f): f is StudentFormation =>
              f !== null &&
              typeof f === 'object' &&
              typeof (f as Record<string, unknown>).name === 'string' &&
              typeof (f as Record<string, unknown>).duration === 'string' &&
              typeof (f as Record<string, unknown>).cost === 'string',
          )
          .slice(0, 3)
      : [];

    const thisWeek = Array.isArray(obj.thisWeek)
      ? obj.thisWeek
          .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
          .slice(0, 3)
      : [];

    if (
      typeof obj.typicalPath !== 'string' ||
      obj.typicalPath.trim().length === 0
    ) return null;
    if (formations.length === 0 || thisWeek.length === 0) return null;

    return {
      track: 'student',
      formations,
      typicalPath: obj.typicalPath.trim(),
      thisWeek,
    };
  }

  // professional
  const delta =
    obj.skillsDelta && typeof obj.skillsDelta === 'object'
      ? (obj.skillsDelta as Record<string, unknown>)
      : undefined;
  const already = Array.isArray(delta?.already)
    ? (delta.already as unknown[])
        .filter((s): s is string => typeof s === 'string')
        .slice(0, 5)
    : [];
  const missing = Array.isArray(delta?.missing)
    ? (delta.missing as unknown[])
        .filter((s): s is string => typeof s === 'string')
        .slice(0, 5)
    : [];

  const cpfFormations = Array.isArray(obj.cpfFormations)
    ? obj.cpfFormations
        .filter(
          (f): f is CpfFormation =>
            f !== null &&
            typeof f === 'object' &&
            typeof (f as Record<string, unknown>).name === 'string' &&
            typeof (f as Record<string, unknown>).duration === 'string',
        )
        .map((f) => ({ ...f, cpfEligible: Boolean(f.cpfEligible) }))
        .slice(0, 3)
    : [];

  const tl =
    obj.timeline && typeof obj.timeline === 'object'
      ? (obj.timeline as Record<string, unknown>)
      : undefined;
  if (
    typeof obj.salaryHint !== 'string' ||
    already.length === 0 ||
    !tl ||
    typeof tl.sixMonths !== 'string' ||
    typeof tl.oneYear !== 'string' ||
    typeof tl.twoYears !== 'string'
  ) {
    return null;
  }

  return {
    track: 'professional',
    skillsDelta: { already, missing },
    cpfFormations,
    salaryHint: obj.salaryHint.trim(),
    timeline: {
      sixMonths: tl.sixMonths.trim(),
      oneYear: tl.oneYear.trim(),
      twoYears: tl.twoYears.trim(),
    },
  };
}
