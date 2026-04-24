import type { JobProfile } from './job.types';

export const JOBS: JobProfile[] = [
  // ─────────────────────────────
  // Tech & Produit
  // ─────────────────────────────
  {
    slug: 'dev-fullstack',
    title: "Développeur·se full-stack",
    tagline: "Concevoir et maintenir des applications web de bout en bout.",
    summary:
      "Tu aimes résoudre des problèmes concrets avec du code, structurer un projet et voir un produit vivre en production.",
    missions: [
      "Développer des interfaces et des API",
      "Participer aux choix techniques et à la qualité du code",
      "Collaborer avec produit et design pour livrer des incréments",
    ],
    skills: ["JavaScript/TypeScript", "Framework front", "API REST", "Git", "Bases SQL/NoSQL"],
    formations: ["Bac+2 à Bac+5 informatique", "Bootcamp + portfolio", "Autodidaxie structurée"],
    salaryRangeHint: "Variable selon expérience et zone — souvent attractif dès les premières années.",
    workContext: "Startup, ESN, grands groupes digitaux, freelance.",
  },
  {
    slug: 'data-analyst',
    title: "Data Analyst",
    tagline: "Transformer les données en décisions.",
    summary:
      "Tu préfères les chiffres, la logique et les tableaux de bord qui éclairent la stratégie.",
    missions: [
      "Collecter et nettoyer des jeux de données",
      "Construire des indicateurs et des visualisations",
      "Présenter des recommandations aux équipes métiers",
    ],
    skills: ["SQL", "Excel/Sheets", "BI (Looker, Power BI…)", "Python optionnel", "Esprit synthétique"],
    formations: ["Écoles de commerce / stats", "Bac+3 à Bac+5 data", "Reconversion certifiante"],
    salaryRangeHint: "Demande forte ; fourchette large selon secteur.",
    workContext: "Retail, finance, tech, conseil, santé.",
  },
  {
    slug: 'data-scientist',
    title: "Data Scientist / ML Engineer",
    tagline: "Construire des modèles qui prédisent, classifient et recommandent.",
    summary:
      "Tu vas plus loin que l'analyse : tu entraînes des modèles, explores des algorithmes et industrialises des pipelines de données.",
    missions: [
      "Explorer et modéliser des données avec des algorithmes ML",
      "Construire et évaluer des modèles prédictifs",
      "Mettre en production des pipelines de données (MLOps)",
    ],
    skills: ["Python (pandas, sklearn, torch)", "Statistiques", "SQL", "Cloud ML", "Sens du problème métier"],
    formations: ["Bac+5 data / IA", "École d'ingénieurs", "Masters statistiques"],
    salaryRangeHint: "Parmi les mieux rémunérés du numérique ; marché tendu sur les profils expérimentés.",
    workContext: "Big Tech, banque/assurance, startups IA, recherche appliquée.",
  },
  {
    slug: 'devops-cloud',
    title: "DevOps / Ingénieur Cloud",
    tagline: "Garantir que les systèmes sont fiables, rapides et scalables.",
    summary:
      "Tu penses infrastructure, automatisation et résilience — le code tourne, les déploiements sont fluides, les alertes silencieuses.",
    missions: [
      "Concevoir et maintenir des infrastructures cloud (AWS, GCP, Azure)",
      "Automatiser les pipelines CI/CD",
      "Surveiller les performances et gérer les incidents",
    ],
    skills: ["Linux", "Docker / Kubernetes", "Terraform / Ansible", "CI/CD", "Monitoring (Datadog, Grafana…)"],
    formations: ["Bac+3 à Bac+5 informatique / réseaux", "Certifications cloud (AWS, GCP)", "Autodidaxie pratique"],
    salaryRangeHint: "Très attractif ; expertise cloud = premium sur le marché.",
    workContext: "ESN, scale-ups, grands groupes, cloud providers.",
  },
  {
    slug: 'ux-designer',
    title: "Designer UX/UI",
    tagline: "Rendre les produits utiles et agréables à utiliser.",
    summary:
      "Tu penses parcours utilisateur, accessibilité et cohérence visuelle sans sacrifier la simplicité.",
    missions: [
      "Conduire des entretiens et tests utilisateurs",
      "Prototyper des parcours (Figma, etc.)",
      "Travailler main dans la main avec les développeurs",
    ],
    skills: ["Recherche utilisateur", "Prototypage", "Design system", "Accessibilité", "Communication"],
    formations: ["Écoles de design", "Bac+3/+5 digital", "Parcours reconversion UX"],
    salaryRangeHint: "En hausse avec l'expérience et la taille des produits.",
    workContext: "Agences, scale-ups, grands comptes avec équipes produit.",
  },
  {
    slug: 'product-owner',
    title: "Product Owner / PM",
    tagline: "Prioriser ce qui crée le plus de valeur.",
    summary:
      "Tu aimes arbitrer, clarifier le besoin métier et faire avancer une roadmap sans te perdre dans les détails techniques.",
    missions: [
      "Rédiger et prioriser le backlog",
      "Animer la découverte et la livraison avec l'équipe",
      "Mesurer l'impact des fonctionnalités",
    ],
    skills: ["Priorisation", "Communication", "Méthodes agile", "Vision business", "Esprit synthétique"],
    formations: ["Commerce / ingénieur / digital", "Certifications agile", "Expérience terrain valorisée"],
    salaryRangeHint: "Souvent lié à l'ancienneté et au secteur (tech vs industrie).",
    workContext: "Éditeurs SaaS, banque, e-commerce, internal IT.",
  },

  // ─────────────────────────────
  // Business & Commerce
  // ─────────────────────────────
  {
    slug: 'sales-b2b',
    title: "Commercial·e B2B",
    tagline: "Convaincre et structurer des cycles de vente.",
    summary:
      "Tu es à l'aise avec la relation client, la négociation et les objectifs — sans forcément être \"technique\".",
    missions: [
      "Prospecter et qualifier des opportunités",
      "Construire des propositions et négocier",
      "Fidéliser un portefeuille de comptes",
    ],
    skills: ["Écoute active", "Argumentation", "CRM", "Organisation", "Résilience"],
    formations: ["Écoles de commerce", "Bac+2/+3 vente", "Beaucoup d'apprentissages sur le terrain"],
    salaryRangeHint: "Fixe + variable selon résultats ; plafond élevé pour les bons profils.",
    workContext: "SaaS, industrie, services, distribution professionnelle.",
  },
  {
    slug: 'business-developer',
    title: "Business Developer",
    tagline: "Ouvrir de nouveaux marchés et construire des partenariats.",
    summary:
      "Tu chasses l'opportunité : nouveaux clients, nouveaux marchés, nouveaux partenaires. Tu combines vision stratégique et action commerciale.",
    missions: [
      "Identifier et cibler de nouveaux segments de marché",
      "Négocier des partenariats stratégiques",
      "Collaborer avec produit et marketing pour aligner offre et demande",
    ],
    skills: ["Prospection", "Négociation", "Vision marché", "Réseau", "Adaptabilité"],
    formations: ["Écoles de commerce", "Sciences po", "Expérience commerciale valorisée"],
    salaryRangeHint: "Package attractif ; variable important sur les profils orientés résultats.",
    workContext: "Startups en hypercroissance, scale-ups, grands groupes en transformation.",
  },
  {
    slug: 'consultant',
    title: "Consultant·e",
    tagline: "Résoudre des problèmes complexes pour des clients variés.",
    summary:
      "Tu aimes analyser, structurer et recommander — en changeant de secteur, de problématique et d'interlocuteur régulièrement.",
    missions: [
      "Analyser une organisation ou un marché",
      "Produire des recommandations actionnables",
      "Accompagner la mise en oeuvre des changements",
    ],
    skills: ["Analyse", "Synthèse", "Présentation", "Rigueur", "Agilité intellectuelle"],
    formations: ["Grandes écoles de commerce / ingénieurs", "Sciences po", "Masters spécialisés"],
    salaryRangeHint: "Élevé en cabinet senior ; progression rapide possible.",
    workContext: "Cabinets de conseil (strategy, IT, RH), freelance, conseil interne.",
  },
  {
    slug: 'chef-de-projet',
    title: "Chef·fe de Projet",
    tagline: "Piloter la livraison d'un projet de A à Z.",
    summary:
      "Tu coordonnes les équipes, gères les délais et les budgets, et t'assures que tout le monde avance dans la même direction.",
    missions: [
      "Planifier et suivre l'avancement du projet",
      "Coordonner les parties prenantes internes et externes",
      "Gérer les risques et les arbitrages",
    ],
    skills: ["Planification", "Communication", "Gestion des risques", "Leadership situationnel", "Outils de suivi (Jira, MS Project…)"],
    formations: ["Écoles d'ingénieurs", "Commerce / management", "Certifications PMP, Prince2"],
    salaryRangeHint: "Stable et progressif ; varie selon secteur et envergure des projets.",
    workContext: "BTP, IT, industrie, événementiel, secteur public.",
  },

  // ─────────────────────────────
  // Finance & Juridique
  // ─────────────────────────────
  {
    slug: 'comptable',
    title: "Comptable / Gestionnaire",
    tagline: "Fiabiliser les chiffres et les obligations.",
    summary:
      "Tu apprécies la rigueur, les process et la conformité — avec une place centrale dans l'organisation.",
    missions: [
      "Tenir ou contrôler la comptabilité",
      "Préparer déclarations et clôtures",
      "Conseiller les opérationnels sur la partie chiffrée",
    ],
    skills: ["Normes comptables", "Outils ERP / logiciels métiers", "Rigueur", "Veille réglementaire"],
    formations: ["DCG / DSCG", "BTS comptabilité", "Écoles de commerce finance"],
    salaryRangeHint: "Progression régulière ; expert-comptable = voie d'évolution.",
    workContext: "Cabinets, PME, grands groupes, secteur public.",
  },
  {
    slug: 'controleur-gestion',
    title: "Contrôleur·se de gestion",
    tagline: "Piloter la performance financière de l'entreprise.",
    summary:
      "Tu traduis les chiffres en leviers de décision : budgets, forecast, analyses d'écarts — avec un lien fort avec les opérationnels.",
    missions: [
      "Élaborer et suivre les budgets",
      "Analyser les écarts et identifier les causes",
      "Produire des reportings et tableaux de bord financiers",
    ],
    skills: ["Excel avancé", "ERP (SAP, Oracle…)", "Analyse financière", "Communication", "Sens du business"],
    formations: ["Master CCA / contrôle de gestion", "Écoles de commerce", "IAE"],
    salaryRangeHint: "Progression significative vers DAF ; package compétitif en grands groupes.",
    workContext: "Industrie, retail, services, grands groupes, ETI.",
  },
  {
    slug: 'juriste',
    title: "Juriste d'entreprise",
    tagline: "Sécuriser l'entreprise sur le plan légal et contractuel.",
    summary:
      "Tu interprètes, conseilles et rédiges : contrats, conformité, litiges — en gardant l'entreprise hors de danger juridique.",
    missions: [
      "Rédiger et négocier des contrats",
      "Conseiller les équipes sur les risques légaux",
      "Assurer une veille réglementaire",
    ],
    skills: ["Droit des affaires", "Rédaction juridique", "Analyse de risque", "Rigueur", "Vulgarisation"],
    formations: ["Master 2 Droit des affaires", "École de droit", "CRFPA pour avocat"],
    salaryRangeHint: "Variable selon spécialité et taille de structure ; conseil = premium.",
    workContext: "Directions juridiques, cabinets d'avocats, institutions.",
  },

  // ─────────────────────────────
  // RH & Management
  // ─────────────────────────────
  {
    slug: 'hr-recruiter',
    title: "Chargé·e de recrutement",
    tagline: "Attirer et sélectionner les meilleurs talents.",
    summary:
      "Tu aimes l'humain, la structuration des process et faire matcher les bonnes personnes avec les bons postes.",
    missions: [
      "Sourcer et qualifier des candidats",
      "Co-construire les fiches de poste avec les managers",
      "Améliorer l'expérience candidat",
    ],
    skills: ["Relationnel", "Organisation", "Outils ATS", "Culture d'entreprise", "Médiation"],
    formations: ["RH, psychologie, écoles de commerce", "Masters RH", "Certifications recrutement"],
    salaryRangeHint: "Stable ; variations selon taille d'entreprise et secteur.",
    workContext: "Cabinet de recrutement, grands groupes, scale-ups.",
  },
  {
    slug: 'charge-rh',
    title: "Chargé·e RH & Formation",
    tagline: "Développer les compétences et accompagner les équipes.",
    summary:
      "Tu travailles sur la durée avec les collaborateurs : plans de formation, GPEC, bien-être au travail — un rôle de facilitateur humain.",
    missions: [
      "Construire et suivre les plans de développement des compétences",
      "Gérer les entretiens annuels et bilans",
      "Animer des actions RH (onboarding, QVT, mobilité interne)",
    ],
    skills: ["Écoute", "Pédagogie", "Outils SIRH", "Droit social de base", "Sens de l'organisation"],
    formations: ["Masters RH / formation", "Licences professionnelles RH", "Reconversion valorisée"],
    salaryRangeHint: "Stable et évolutif vers DRH ; secteur public = grilles spécifiques.",
    workContext: "PME, collectivités, associations, grands groupes.",
  },
  {
    slug: 'office-manager',
    title: "Office Manager",
    tagline: "Faire tourner la structure pour que tout le monde puisse bosser sereinement.",
    summary:
      "Tu orchestres l'opérationnel : locaux, fournisseurs, onboarding, process internes — le liant invisible qui rend l'entreprise fonctionnelle.",
    missions: [
      "Gérer les prestataires, contrats et espaces de travail",
      "Coordonner l'onboarding des nouveaux arrivants",
      "Optimiser les processus administratifs internes",
    ],
    skills: ["Organisation", "Polyvalence", "Communication", "Rigueur", "Sens du service"],
    formations: ["BTS assistanat", "Bac+3 gestion / management", "Expérience valorisée"],
    salaryRangeHint: "Souvent sous-évalué mais en progression dans les startups / scale-ups.",
    workContext: "Startups, PME, scale-ups, cabinets professionnels.",
  },

  // ─────────────────────────────
  // Marketing & Communication
  // ─────────────────────────────
  {
    slug: 'marketing-digital',
    title: "Marketeur·se digital",
    tagline: "Faire croître la visibilité et la conversion.",
    summary:
      "Tu mixes créativité, mesure et itération : campagnes, contenus, SEO/SEA selon les canaux.",
    missions: [
      "Définir des campagnes et calendriers éditoriaux",
      "Analyser les performances et optimiser",
      "Collaborer avec produit et sales sur les objectifs",
    ],
    skills: ["Analytics", "Rédaction / storytelling", "SEO/SEA de base", "Réseaux sociaux", "A/B testing"],
    formations: ["Marketing / communication", "Bac+3/+5 digital", "Formations certifiantes plateformes"],
    salaryRangeHint: "Très hétérogène ; le performance marketing peut être premium.",
    workContext: "E-commerce, SaaS, agences, médias.",
  },
  {
    slug: 'content-creator',
    title: "Créateur·trice de contenu / Social Media Manager",
    tagline: "Construire une audience et raconter des histoires qui engagent.",
    summary:
      "Tu penses formats, tonalité et algorithmes : vidéos, articles, posts — tu crées du contenu qui génère de l'engagement et de la notoriété.",
    missions: [
      "Produire des contenus adaptés à chaque plateforme",
      "Animer les communautés et répondre aux audiences",
      "Analyser les performances et ajuster la stratégie éditoriale",
    ],
    skills: ["Rédaction / storytelling", "Outils de création (Canva, CapCut, Premiere…)", "Réseaux sociaux", "SEO de base", "Créativité"],
    formations: ["Communication / journalisme", "Licence/Master digital", "Autodidaxie + portfolio"],
    salaryRangeHint: "Variable ; freelance / personal brand peuvent dépasser le salariat.",
    workContext: "Médias, marques, agences, indépendant.",
  },
  {
    slug: 'graphiste',
    title: "Graphiste / Motion Designer",
    tagline: "Donner vie aux idées avec des visuels qui marquent.",
    summary:
      "Tu maîtrises les codes visuels, la typographie et le mouvement pour concevoir des supports print, web ou vidéo cohérents et percutants.",
    missions: [
      "Concevoir des chartes graphiques et identités visuelles",
      "Produire des visuels print, digitaux et motion",
      "Collaborer avec les équipes marketing et communication",
    ],
    skills: ["Suite Adobe (Ps, Ai, Ae)", "Figma", "Sens de l'esthétique", "Typographie", "Brief client"],
    formations: ["Écoles d'art / communication visuelle", "BTS design graphique", "Autodidaxie + portfolio solide"],
    salaryRangeHint: "Varie beaucoup : junior modeste, senior / freelance spécialisé = attractif.",
    workContext: "Agences de communication, studios, équipes marketing intégrées, freelance.",
  },
  {
    slug: 'responsable-com',
    title: "Responsable Communication",
    tagline: "Construire et protéger l'image d'une organisation.",
    summary:
      "Tu pilotes la stratégie de communication interne et externe : messages, canaux, relations presse, événements — en cohérence avec la marque.",
    missions: [
      "Définir et déployer la stratégie de communication",
      "Gérer les relations presse et les partenariats médias",
      "Superviser la production de contenus et d'événements",
    ],
    skills: ["Stratégie", "Rédaction", "Relations presse", "Gestion de projet", "Sens de la marque"],
    formations: ["Écoles de commerce / com", "Masters communication", "Sciences po"],
    salaryRangeHint: "Progression vers Directeur Communication ; secteur public = grilles spécifiques.",
    workContext: "Grands groupes, collectivités, associations, agences RP.",
  },
];
