import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Seed du questionnaire — v2 : questionnaire enrichi 15 questions.
 *
 * Format des `domainWeights` : { "M": 3, "J": 2, ... }
 * Clés = codes grand domaine ROME (France Travail) :
 *   A — Agriculture, espaces naturels, soins aux animaux
 *   B — Arts et façonnage d'ouvrages d'art
 *   C — Banque, assurance, immobilier
 *   D — Commerce, vente, grande distribution
 *   E — Communication, média, multimédia
 *   F — Construction, BTP
 *   G — Hôtellerie-restauration, tourisme, animation
 *   H — Industrie
 *   I — Installation, maintenance
 *   J — Santé
 *   K — Services à la personne et à la collectivité
 *   L — Spectacle
 *   M — Support à l'entreprise (IT, RH, finance, conseil…)
 *   N — Transport, logistique
 *
 * Poids de référence :
 *   5 = signal très fort (question très discriminante pour ce domaine)
 *   4 = fort
 *   3 = modéré
 *   2 = faible
 *   1 = signal additionnel
 *
 * Stratégie des questions conditionnelles :
 *   - `trajectoire` (askIfNotEquals: { situation: lycee }) — pour actifs / étudiants / reconversion
 *   - `secteur_lycee` (askIfEquals: { situation: lycee }) — pour les lycéens
 *
 * NB : le champ legacy `jobWeights` est conservé vide pour ne pas casser
 * le schéma Prisma. Il sera retiré lors d'une prochaine migration.
 */

type SeedQuestion = {
  key: string;
  text: string;
  orderHint: number;
  type?: 'SINGLE_CHOICE' | 'FREE_TEXT';
  placeholder?: string;
  helperText?: string;
  askIfEquals?: Record<string, string>;
  askIfNotEquals?: Record<string, string>;
  options: Array<{
    key: string;
    label: string;
    jobWeights: Record<string, number>;
    domainWeights: Record<string, number>;
  }>;
};

const QUESTIONS: SeedQuestion[] = [
  // ── 1. Situation (contextuel — ne contribue pas au scoring) ────────────
  {
    key: 'situation',
    text: 'Pour commencer — tu es plutôt…',
    orderHint: 1,
    options: [
      {
        key: 'lycee',
        label: 'Au lycée ou en études courtes (CAP, BTS…)',
        jobWeights: {},
        domainWeights: {},
      },
      {
        key: 'etudes_longues',
        label: 'En études longues (Bac+3 et plus)',
        jobWeights: {},
        domainWeights: {},
      },
      {
        key: 'reconversion',
        label: 'En reconversion professionnelle',
        jobWeights: {},
        domainWeights: {},
      },
      {
        key: 'actif',
        label: 'Déjà en poste et tu explores d\'autres voies',
        jobWeights: {},
        domainWeights: {},
      },
    ],
  },

  // ── 2. Domaine de passion — signal le plus fort sur le domaine ROME ───
  //
  // Utilise des codes sous-domaine ROME à 3 chars pour les options qui
  // ciblent un sous-ensemble précis d'un grand domaine :
  //   M18 = Systèmes d'information et télécommunications (IT, dev, data)
  //   M11 = Comptabilité et gestion
  //   M13 = Conseil et maîtrise d'ouvrage SI (consulting IT)
  // Sans ces codes, "tech" pointerait vers tout M (compta, RH, météo…).
  {
    key: 'domaine_passion',
    text: 'Quel domaine t\'attire vraiment — dans tes loisirs, tes études ou ta curiosité ?',
    orderHint: 2,
    helperText: 'Choisis le plus fort, même si tu en as plusieurs.',
    options: [
      {
        key: 'nature_vivant',
        label: 'La nature, les animaux ou l\'environnement',
        jobWeights: {},
        domainWeights: { A: 5 },
      },
      {
        key: 'tech_numerique',
        label: 'La tech, l\'informatique, les données',
        jobWeights: {},
        // M18 = sous-domaine IT/télécoms — évite de remonter compta, RH, météo
        domainWeights: { M18: 5 },
      },
      {
        key: 'humain_social',
        label: 'L\'humain : la santé, le social ou l\'éducation',
        jobWeights: {},
        domainWeights: { J: 3, K: 3 },
      },
      {
        key: 'creatif_artistique',
        label: 'La création : art, culture, médias ou communication',
        jobWeights: {},
        domainWeights: { B: 3, E: 3, L: 2 },
      },
      {
        key: 'btp_industrie',
        label: 'La mécanique, l\'industrie, le bâtiment ou l\'énergie',
        jobWeights: {},
        domainWeights: { F: 3, H: 3, I: 3 },
      },
      {
        key: 'commerce_entreprise',
        label: 'L\'entreprise, le commerce ou la finance',
        jobWeights: {},
        // M11 = Comptabilité et gestion, M13 = Conseil et MOA SI
        domainWeights: { D: 3, C: 3, M11: 2, M13: 1 },
      },
    ],
  },

  // ── 3. Cadre de travail ────────────────────────────────────────────────
  {
    key: 'cadre_travail',
    text: 'Dans quel cadre tu t\'imagines travailler au quotidien ?',
    orderHint: 3,
    options: [
      {
        key: 'dehors_terrain',
        label: 'En extérieur ou sur le terrain — pas de journées identiques',
        jobWeights: {},
        domainWeights: { A: 3, F: 3, N: 2, I: 2 },
      },
      {
        key: 'bureau_ecran',
        label: 'En bureau ou en télétravail, face à un écran',
        jobWeights: {},
        domainWeights: { M: 3, C: 2, E: 2 },
      },
      {
        key: 'face_public',
        label: 'En contact direct avec des clients, patients ou usagers',
        jobWeights: {},
        domainWeights: { D: 3, J: 3, G: 2, K: 2 },
      },
      {
        key: 'atelier_labo',
        label: 'En atelier, laboratoire ou studio — un espace dédié',
        jobWeights: {},
        domainWeights: { H: 3, B: 3, I: 2, J: 1 },
      },
    ],
  },

  // ── 4. Manuel ou intellectuel ──────────────────────────────────────────
  {
    key: 'manuel_bureau',
    text: 'Tu te vois plutôt…',
    orderHint: 4,
    options: [
      {
        key: 'tres_manuel',
        label: 'Travailler de mes mains — construire, réparer, fabriquer',
        jobWeights: {},
        domainWeights: { F: 4, I: 4, H: 3, B: 2, A: 2 },
      },
      {
        key: 'mixte',
        label: 'Mélanger action physique et réflexion',
        jobWeights: {},
        domainWeights: { G: 2, D: 2, K: 2, J: 2, N: 2 },
      },
      {
        key: 'intellectuel',
        label: 'Analyser, réfléchir, résoudre des problèmes complexes',
        jobWeights: {},
        domainWeights: { M: 4, C: 3, E: 2 },
      },
      {
        key: 'creatif_expression',
        label: 'Créer et exprimer — dessin, texte, son, image…',
        jobWeights: {},
        domainWeights: { B: 4, L: 4, E: 3 },
      },
    ],
  },

  // ── 5. Contact humain ──────────────────────────────────────────────────
  {
    key: 'contact_humain',
    text: 'Ton rapport idéal aux autres dans le travail…',
    orderHint: 5,
    options: [
      {
        key: 'beaucoup_monde',
        label: 'Beaucoup de monde — clients, public, patients au quotidien',
        jobWeights: {},
        domainWeights: { D: 3, G: 3, J: 3, K: 3 },
      },
      {
        key: 'equipe_soudee',
        label: 'Une équipe soudée avec qui je construis quelque chose',
        jobWeights: {},
        domainWeights: { M: 2, F: 2, H: 2, E: 2 },
      },
      {
        key: 'peu_monde',
        label: 'Peu de monde — concentration et autonomie avant tout',
        jobWeights: {},
        domainWeights: { A: 3, B: 3, M: 2 },
      },
      {
        key: 'variable',
        label: 'Variable — parfois seul, parfois en réunion ou sur le terrain',
        jobWeights: {},
        domainWeights: { N: 2, C: 2, I: 2, K: 1 },
      },
    ],
  },

  // ── 6. Ce qui compte le plus dans un métier ────────────────────────────
  {
    key: 'valeur_cle',
    text: 'Ce qui compte le plus pour toi dans un métier…',
    orderHint: 6,
    helperText: 'Si tu ne devais retenir qu\'une chose.',
    options: [
      {
        key: 'impact_sens',
        label: 'Un impact concret sur les gens ou sur l\'environnement',
        jobWeights: {},
        domainWeights: { J: 3, K: 3, A: 2, E: 1 },
      },
      {
        key: 'evolution_salaire',
        label: 'Être bien payé et évoluer vite',
        jobWeights: {},
        domainWeights: { M: 4, C: 3, D: 2 },
      },
      {
        key: 'creativite_liberte',
        label: 'Liberté, créativité — faire les choses à ma façon',
        jobWeights: {},
        domainWeights: { B: 3, E: 3, L: 3, A: 1 },
      },
      {
        key: 'securite_stabilite',
        label: 'Sécurité d\'emploi, un cadre solide et prévisible',
        jobWeights: {},
        domainWeights: { K: 3, J: 2, C: 2, M: 1 },
      },
      {
        key: 'apprendre_innover',
        label: 'Apprendre en permanence, ne jamais faire deux fois la même chose',
        jobWeights: {},
        domainWeights: { M: 3, J: 2, I: 2, F: 1 },
      },
    ],
  },

  // ── 7. Rapport au salaire ──────────────────────────────────────────────
  {
    key: 'rapport_salaire',
    text: 'Le salaire dans ton équation de vie…',
    orderHint: 7,
    options: [
      {
        key: 'salaire_priorite',
        label: 'Priorité numéro 1 — je veux maximiser mes revenus',
        jobWeights: {},
        domainWeights: { M: 4, C: 3, D: 2 },
      },
      {
        key: 'salaire_confort',
        label: 'Important, mais pas le seul critère — je veux être à l\'aise',
        jobWeights: {},
        domainWeights: { M: 2, D: 2, J: 2, C: 1 },
      },
      {
        key: 'salaire_secondaire',
        label: 'Secondaire — l\'épanouissement et le sens passent avant',
        jobWeights: {},
        domainWeights: { A: 2, K: 2, J: 1, B: 1, L: 1 },
      },
    ],
  },

  // ── 8. Mobilité géographique ───────────────────────────────────────────
  {
    key: 'mobilite',
    text: 'Ta mobilité géographique…',
    orderHint: 8,
    options: [
      {
        key: 'ancre_local',
        label: 'Je veux rester dans ma région — ancrage local important',
        jobWeights: {},
        domainWeights: { K: 2, J: 2, F: 2, I: 2, A: 2 },
      },
      {
        key: 'deplacements_ponctuels',
        label: 'Des déplacements ponctuels OK, mais avec un QG fixe',
        jobWeights: {},
        domainWeights: { D: 2, M: 2, C: 2, G: 1 },
      },
      {
        key: 'tres_mobile',
        label: 'Toujours en mouvement — j\'aime changer d\'environnement',
        jobWeights: {},
        domainWeights: { N: 4, G: 3, D: 2 },
      },
      {
        key: 'international',
        label: 'L\'international m\'attire — voyager ou travailler à l\'étranger',
        jobWeights: {},
        domainWeights: { E: 3, M: 2, G: 2, D: 1 },
      },
    ],
  },

  // ── 9. Rythme de travail ───────────────────────────────────────────────
  {
    key: 'rythme',
    text: 'Le rythme professionnel qui te convient…',
    orderHint: 9,
    options: [
      {
        key: 'horaires_fixes',
        label: 'Horaires fixes et prévisibles — je déconnecte le soir',
        jobWeights: {},
        domainWeights: { K: 3, C: 2, H: 2, M: 1 },
      },
      {
        key: 'flexible',
        label: 'Flexible — je gère mon agenda selon mes missions',
        jobWeights: {},
        domainWeights: { M: 3, E: 2, B: 2, D: 1 },
      },
      {
        key: 'intense_sprints',
        label: 'Intense par cycles — je kiffe les deadlines et les sprints',
        jobWeights: {},
        domainWeights: { M: 3, D: 2, E: 2, N: 1 },
      },
      {
        key: 'saisonnier',
        label: 'Saisonnier ou à projets — des pics et des temps calmes',
        jobWeights: {},
        domainWeights: { A: 3, G: 3, L: 2, F: 1 },
      },
    ],
  },

  // ── 10. Compétence naturelle ────────────────────────────────────────────
  {
    key: 'competence_naturelle',
    text: 'Ce dans quoi tu es naturellement à l\'aise, ton vrai point fort…',
    orderHint: 10,
    options: [
      {
        key: 'tech_outils',
        label: 'La tech et les outils numériques — je comprends vite les systèmes',
        jobWeights: {},
        // M18 = sous-domaine IT/télécoms (confirmation du signal de domaine_passion)
        domainWeights: { M18: 5, I: 2 },
      },
      {
        key: 'relation_persuasion',
        label: 'Le contact et la conviction — à l\'aise en face-à-face',
        jobWeights: {},
        domainWeights: { D: 3, G: 2, J: 2, K: 2 },
      },
      {
        key: 'creation_expression',
        label: 'La créativité et l\'expression — un vrai sens esthétique',
        jobWeights: {},
        domainWeights: { B: 4, E: 4, L: 3 },
      },
      {
        key: 'organisation_rigueur',
        label: 'L\'organisation et la rigueur — j\'aime que les choses soient bien faites',
        jobWeights: {},
        domainWeights: { M: 3, C: 3, N: 2, F: 1 },
      },
      {
        key: 'habilete_manuelle',
        label: 'L\'habileté manuelle et la précision physique',
        jobWeights: {},
        domainWeights: { F: 4, I: 4, H: 3, B: 2 },
      },
    ],
  },

  // ── 11. Rapport à la formation ─────────────────────────────────────────
  {
    key: 'formation',
    text: 'Pour te lancer dans un métier, tu es prêt(e) à…',
    orderHint: 11,
    options: [
      {
        key: 'longues_etudes',
        label: 'Des études longues (5 ans et +) si c\'est ce qu\'il faut',
        jobWeights: {},
        domainWeights: { J: 3, M: 2, C: 2, E: 1 },
      },
      {
        key: 'formation_courte',
        label: 'Une formation ciblée (1 à 3 ans, alternance, certif)',
        jobWeights: {},
        domainWeights: { I: 2, D: 2, F: 2, H: 2, M: 1 },
      },
      {
        key: 'apprendre_terrain',
        label: 'Apprendre directement sur le terrain, en faisant',
        jobWeights: {},
        domainWeights: { G: 3, A: 2, N: 2, F: 1, D: 1 },
      },
      {
        key: 'autodidacte',
        label: 'Me former seul(e) — tutos, projets perso, portfolio',
        jobWeights: {},
        domainWeights: { M: 3, E: 3, B: 2, L: 1 },
      },
    ],
  },

  // ── 12a. Trajectoire (non-lycéens) ─────────────────────────────────────
  {
    key: 'trajectoire',
    text: 'Quelle trajectoire te ressemble le plus ?',
    orderHint: 12,
    askIfNotEquals: { situation: 'lycee' },
    options: [
      {
        key: 'expert',
        label: 'Devenir un expert reconnu dans mon domaine',
        jobWeights: {},
        domainWeights: { J: 3, M: 3, C: 2 },
      },
      {
        key: 'entrepreneur',
        label: 'Créer ou co-créer mon activité',
        jobWeights: {},
        domainWeights: { D: 3, M: 2, A: 2, B: 1 },
      },
      {
        key: 'management',
        label: 'Évoluer vers le management et les responsabilités',
        jobWeights: {},
        domainWeights: { M: 4, D: 2, K: 1 },
      },
      {
        key: 'equilibre',
        label: 'Un bon équilibre vie pro / vie perso — pas de course aux galons',
        jobWeights: {},
        domainWeights: { K: 3, A: 2, J: 2, G: 1 },
      },
    ],
  },

  // ── 12b. Secteur attractif (lycéens) ──────────────────────────────────
  {
    key: 'secteur_lycee',
    text: 'Si tu devais choisir un grand secteur pour ton avenir, tu pencherais vers…',
    orderHint: 13,
    askIfEquals: { situation: 'lycee' },
    options: [
      {
        key: 'sante_social',
        label: 'La santé, le médico-social ou l\'éducation',
        jobWeights: {},
        domainWeights: { J: 4, K: 3 },
      },
      {
        key: 'tech_num_lycee',
        label: 'La tech, l\'informatique ou le numérique',
        jobWeights: {},
        domainWeights: { M18: 5 },
      },
      {
        key: 'creation_culture',
        label: 'La création, les arts ou la culture',
        jobWeights: {},
        domainWeights: { B: 4, E: 3, L: 3 },
      },
      {
        key: 'btp_nature_lycee',
        label: 'Le BTP, l\'industrie, la nature ou l\'agriculture',
        jobWeights: {},
        domainWeights: { F: 3, H: 3, A: 3, I: 2 },
      },
      {
        key: 'commerce_tourisme',
        label: 'Le commerce, la gestion, le tourisme ou la restauration',
        jobWeights: {},
        domainWeights: { D: 3, G: 3, C: 2 },
      },
    ],
  },

  // ── 13. Journée idéale (texte libre) ──────────────────────────────────
  // Le texte libre est transmis tel quel à l'IA pour le reranking final.
  // Il ne génère pas de domainWeights — son impact est qualitatif.
  {
    key: 'journee_ideale',
    text: 'Décris une journée (passée ou imaginée) où tu t\'es senti(e) pleinement à ta place. Que faisais-tu ? Avec qui ? Qu\'est-ce qui la rendait bonne ?',
    orderHint: 20,
    type: 'FREE_TEXT',
    placeholder: 'Ex : "J\'organisais un évènement pour l\'asso, je coordonnais les bénévoles, je voyais les gens sourire..."',
    helperText: 'Plus tu es concret(e) et personnel(le), mieux c\'est. 2 à 5 phrases suffisent.',
    options: [],
  },

  // ── 14. Irritants (texte libre) ────────────────────────────────────────
  {
    key: 'irritants',
    text: 'À l\'inverse, qu\'est-ce qui te gonfle ou t\'épuise dans un boulot, dans les études ou en groupe ?',
    orderHint: 21,
    type: 'FREE_TEXT',
    placeholder: 'Ex : "Faire la même tâche répétitive, les réunions sans décision, travailler seul devant un écran..."',
    helperText: 'Les choses à éviter en disent autant que celles qu\'on aime.',
    options: [],
  },

  // ── 15. Fascination (texte libre) ──────────────────────────────────────
  {
    key: 'fascination',
    text: 'Un métier, une personne dont tu admires le travail, ou une activité qui te fascine — et pourquoi ?',
    orderHint: 22,
    type: 'FREE_TEXT',
    placeholder: 'Ex : "Ma cousine est sage-femme, j\'adore qu\'elle aide les gens dans un moment important..."',
    helperText: 'Même si ce n\'est pas un métier que tu veux faire, explique ce qui t\'attire.',
    options: [],
  },
];

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    // Désactiver toutes les anciennes questions avant de seeder
    // (les nouvelles seront upsertées avec active: true)
    await prisma.question.updateMany({ data: { active: false } });
    console.log('Anciennes questions désactivées.');

    for (const question of QUESTIONS) {
      const upserted = await prisma.question.upsert({
        where: { key: question.key },
        update: {
          text: question.text,
          orderHint: question.orderHint,
          type: question.type ?? 'SINGLE_CHOICE',
          placeholder: question.placeholder ?? null,
          helperText: question.helperText ?? null,
          askIfEquals: question.askIfEquals
            ? (question.askIfEquals as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          askIfNotEquals: question.askIfNotEquals
            ? (question.askIfNotEquals as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          active: true,
        },
        create: {
          key: question.key,
          text: question.text,
          orderHint: question.orderHint,
          type: question.type ?? 'SINGLE_CHOICE',
          placeholder: question.placeholder ?? null,
          helperText: question.helperText ?? null,
          askIfEquals: question.askIfEquals
            ? (question.askIfEquals as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          askIfNotEquals: question.askIfNotEquals
            ? (question.askIfNotEquals as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          active: true,
        },
      });

      for (const option of question.options) {
        await prisma.questionOption.upsert({
          where: {
            questionId_key: {
              questionId: upserted.id,
              key: option.key,
            },
          },
          update: {
            label: option.label,
            jobWeights: option.jobWeights,
            domainWeights: option.domainWeights,
          },
          create: {
            questionId: upserted.id,
            key: option.key,
            label: option.label,
            jobWeights: option.jobWeights,
            domainWeights: option.domainWeights,
          },
        });
      }

      console.log(`  ✓ ${question.key}`);
    }

    console.log('\n✓ Seed terminé — 15 questions actives.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
