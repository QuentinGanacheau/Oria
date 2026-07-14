import Link from "next/link";
import {
  ArrowRight,
  Brain,
  Check,
  ChevronDown,
  ClipboardCheck,
  Heart,
  Layers,
  PenLine,
  Target,
  User,
  X,
} from "lucide-react";
import ThemeToggle from "@/components/theme-toggle";

// ─── Data ─────────────────────────────────────────────────────────────────────

const PROBLEMS = [
  {
    title: "Des listes sans explication",
    body: "40 métiers qui « correspondent à ton profil »… sans te dire pourquoi ni lequel prioriser.",
  },
  {
    title: "Des conseils trop génériques",
    body: "« Tu aimes le contact ? Tu pourrais être commercial, RH ou formateur. » Difficile d'en faire quelque chose.",
  },
  {
    title: "Aucune place pour s'exprimer",
    body: "Cases à cocher et boutons radio, mais jamais l'occasion de dire ce qui compte vraiment pour toi.",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Tu parles de toi",
    body: "Le questionnaire s'adapte à ton profil en temps réel : lycéen, étudiant, salarié en reconversion… chaque parcours est différent.",
    Icon: User,
  },
  {
    number: "02",
    title: "L'IA dresse ton portrait",
    body: "L'IA fait d'abord ton portrait — tes forces, ce qui t'anime — puis croise tes réponses avec le répertoire officiel des métiers pour repérer ce qui te correspond vraiment, pas juste les mots-clés.",
    Icon: Brain,
  },
  {
    number: "03",
    title: "Tu explores tes pistes",
    body: "Tu découvres tes métiers carte par carte, comme un deck à swiper. Tu gardes ce qui te parle, tu écartes le reste — et l'IA affine les suivants à partir de tes choix.",
    Icon: Layers,
  },
];

const DIFFERENTIATORS = [
  {
    Icon: Target,
    title: "Tu swipes, l'IA affine",
    body: "Chaque carte a un score calculé à partir de tes réponses. À chaque paquet, l'IA tient compte de ce que tu as gardé ou écarté pour proposer des métiers de plus en plus justes — même ceux que tu n'aurais jamais cherchés.",
  },
  {
    Icon: Brain,
    title: "Des questions qui s'adaptent",
    body: "Pas de questionnaire générique à 80 cases. Les questions changent selon ce que tu as déjà répondu pour aller à l'essentiel.",
  },
  {
    Icon: PenLine,
    title: "Exprime-toi librement",
    body: "Tu peux écrire tes passions, tes contraintes, ce que tu refuses. L'IA lit entre les lignes, pas juste les cases cochées.",
  },
  {
    Icon: ClipboardCheck,
    title: "Des fiches vraiment personnalisées",
    body: "Chaque métier que tu débloques a une fiche rédigée pour toi : ce qui va te plaire, les points de vigilance, un plan d'action concret et une journée type.",
  },
];

const TESTIMONIALS = [
  {
    quote: "J'avais fait des dizaines de tests d'orientation. Celui-là est le premier à m'avoir donné une explication qui tenait la route.",
    name: "Camille R.",
    role: "Étudiante en L2, en réorientation",
    initials: "CR",
  },
  {
    quote: "En reconversion après 8 ans dans la finance. Les pistes proposées m'ont confirmé ce que je ressentais — et m'ont donné les mots pour en parler.",
    name: "Thomas M.",
    role: "35 ans, en reconversion",
    initials: "TM",
  },
  {
    quote: "Rapide, pertinent, sans bullshit. J'ai partagé le lien à tous mes potes qui galèrent avec Parcoursup.",
    name: "Léa D.",
    role: "Terminale, en pleine recherche",
    initials: "LD",
  },
];

const FAQS = [
  {
    q: "Combien de temps prend le questionnaire ?",
    a: "Entre 5 et 10 minutes. Le questionnaire est adaptatif : il s'arrête quand il a suffisamment d'informations pour te donner un résultat fiable.",
  },
  {
    q: "C'est vraiment gratuit ?",
    a: "Oui. Ton portrait et tes 3 premières pistes sont gratuits, sans inscription. Pour continuer à explorer — de nouveaux métiers affinés par l'IA et les fiches personnalisées — un paiement unique de 5,90 €.",
  },
  {
    q: "Pour qui c'est fait ?",
    a: "Pour les lycéens qui choisissent leur orientation, les étudiants qui veulent se réorienter, et les actifs qui envisagent une reconversion. Le questionnaire s'adapte à chaque situation.",
  },
  {
    q: "Mes données sont-elles conservées ?",
    a: "Tes réponses sont liées à ta session de navigation, pas à un compte. Rien n'est vendu ni partagé. Les résultats sont stockés localement sur ton appareil.",
  },
  {
    q: "Qu'est-ce que je débloque en payant ?",
    a: "Tu continues à explorer : l'IA te propose de nouveaux paquets de métiers, affinés à chaque fois selon ce que tu as gardé ou écarté. Chaque métier débloqué a sa fiche personnalisée : ce qui va te plaire selon ton profil, les points de vigilance, un plan d'action concret et une journée type.",
  },
];

// ─── Primitives ─────────────────────────────────────────────────────────────

function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 font-serif tracking-tight ${className}`}>
      Oryam
      <span className="mb-1.5 inline-block size-[9px] rounded-full bg-accent" />
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://oryam.fr";

// Données structurées identité de site : Organization + WebSite.
const HOME_JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Oryam",
      url: `${SITE_URL}/`,
      logo: `${SITE_URL}/web-app-manifest-512x512.png`,
      description:
        "Le bilan de compétence express, digital et abordable : explore les métiers qui te ressemblent en 20 minutes.",
    },
    {
      "@type": "WebSite",
      name: "Oryam",
      url: `${SITE_URL}/`,
      inLanguage: "fr-FR",
    },
  ],
};

export default function Home() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(HOME_JSON_LD).replace(/</g, "\\u003c"),
        }}
      />

      {/* ── Navigation ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-line bg-paper/80 backdrop-blur-md">
        <div className="mx-auto flex h-[70px] max-w-[1180px] items-center justify-between px-6">
          <div className="flex items-center gap-10">
            <Logo className="text-[26px]" />
            <nav className="hidden items-center gap-8 text-[15px] text-ink-soft md:flex">
              <a href="#comment" className="transition-colors hover:text-accent-ink">
                Comment ça marche
              </a>
              <a href="#tarifs" className="transition-colors hover:text-accent-ink">
                Tarifs
              </a>
              <a href="#faq" className="transition-colors hover:text-accent-ink">
                FAQ
              </a>
              <Link href="/metiers" className="transition-colors hover:text-accent-ink">
                Métiers
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3.5">
            <ThemeToggle />
            <Link
              href="/questionnaire"
              className="group inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-[15px] font-semibold text-paper transition hover:bg-accent hover:text-white"
            >
              Faire le test
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </header>

      <main>

        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          <div className="mx-auto grid max-w-[1180px] items-center gap-12 px-6 pb-10 pt-16 lg:grid-cols-[1.05fr_.95fr] lg:gap-14">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-ink">
                Orientation · Reconversion
              </p>
              <h1 className="mt-5 font-serif text-[clamp(46px,6.4vw,84px)] leading-[1.04] tracking-tight">
                Découvre les métiers{" "}
                <em className="italic text-accent">qui te correspondent</em> vraiment.
              </h1>
              <p className="mt-6 max-w-[30em] text-[19px] leading-relaxed text-ink-soft">
                Un questionnaire intelligent analyse tes valeurs, ta personnalité et
                tes ambitions. En quelques minutes, tu obtiens ton portrait et des
                pistes métiers à explorer une à une — chacune avec l'explication
                précise qui justifie le match.
              </p>
              <div className="mt-8 flex flex-wrap gap-3.5">
                <Link
                  href="/questionnaire"
                  className="group inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-[15px] font-semibold text-paper transition hover:bg-accent hover:text-white"
                >
                  Faire le test gratuitement
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <a
                  href="#comment"
                  className="inline-flex items-center rounded-full border border-line-strong px-6 py-3.5 text-[15px] font-semibold text-ink transition hover:bg-surface"
                >
                  Comment ça marche
                </a>
              </div>
              <div className="mt-6 flex flex-wrap gap-5 text-sm text-muted">
                {["Gratuit", "Sans inscription", "3 pistes offertes"].map((t) => (
                  <span key={t} className="inline-flex items-center gap-2">
                    <Check className="size-4 text-ok" strokeWidth={2.2} />
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Mockup carte à swiper */}
            <div className="relative [transform:rotate(.5deg)]">
              {/* cartes empilées en arrière-plan, pour suggérer le deck */}
              <div className="absolute inset-x-4 -bottom-3 top-3 rounded-[22px] border border-line bg-surface-2/60" />
              <div className="absolute inset-x-2 -bottom-1.5 top-1.5 rounded-[22px] border border-line bg-surface-2" />

              <div className="relative overflow-hidden rounded-[22px] border border-line-strong bg-surface shadow-[0_30px_60px_-30px_rgba(40,30,15,.35)]">
                <div className="flex items-center justify-between bg-gradient-to-r from-accent-ink to-accent px-5 py-4 text-white">
                  <span className="text-[13px] font-semibold tracking-wide opacity-90">Piste #1</span>
                  <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
                    94% d&apos;adéquation
                  </span>
                </div>
                <div className="px-6 pb-6 pt-5">
                  <h3 className="font-serif text-[26px] leading-tight tracking-tight">
                    UX / Product Designer
                  </h3>
                  <p className="mt-1.5 text-[15px] text-ink-soft">
                    Conception, créativité, impact concret
                  </p>
                  <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-ink">
                    Pourquoi ce métier te correspond
                  </p>
                  <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
                    Tu as cité l&apos;envie de créer des choses utiles et d&apos;en voir
                    l&apos;effet concret — ce métier place exactement ça au centre.
                  </p>
                  <div className="mt-6 flex items-center justify-center gap-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-no/40 px-4 py-2 text-sm font-semibold text-no">
                      <X className="size-4" strokeWidth={2.4} /> Passe
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-ok/40 bg-accent-soft px-4 py-2 text-sm font-semibold text-accent-ink">
                      <Heart className="size-4" strokeWidth={2.2} /> J&apos;aime
                    </span>
                  </div>
                </div>
              </div>
              <p className="mt-5 text-center text-[13px] text-muted">
                Swipe pour garder ou écarter — l&apos;IA affine les suivants.
              </p>
            </div>
          </div>
        </section>

        {/* ── Bande stats ─────────────────────────────────────────────────── */}
        <section className="border-y border-line bg-surface-2">
          <div className="mx-auto flex max-w-[1180px] flex-wrap px-6 py-6">
            {[
              { value: "1 500+", label: "métiers passés au crible" },
              { value: "5 min", label: "en moyenne" },
              { value: "3", label: "pistes gratuites" },
              { value: "IA", label: "personnalisation poussée" },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className={`min-w-[140px] flex-1 px-6 ${i > 0 ? "border-l border-line" : ""}`}
              >
                <div className="font-serif text-[38px] leading-none">{stat.value}</div>
                <div className="mt-1 text-[13.5px] text-muted">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Problème ────────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-[1180px] px-6 py-[92px]">
          <div className="max-w-[30em]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-ink">
              Le problème
            </p>
            <h2 className="mt-3.5 font-serif text-[clamp(32px,4vw,52px)] leading-tight tracking-tight">
              Les tests d'orientation classiques ne tiennent pas leurs promesses.
            </h2>
            <p className="mt-3.5 text-[18px] text-ink-soft">
              Tu as probablement déjà essayé. Et tu sais ce que tu obtiens.
            </p>
          </div>

          <div className="mt-12 grid gap-[18px] sm:grid-cols-3">
            {PROBLEMS.map((item, i) => (
              <div
                key={item.title}
                className="rounded-[18px] border border-line bg-surface p-7"
              >
                <div className="grid size-[34px] place-items-center rounded-full border border-accent font-serif text-[18px] text-accent">
                  {i + 1}
                </div>
                <h3 className="mt-4 text-[19px] font-semibold tracking-tight">{item.title}</h3>
                <p className="mt-2 text-[15px] text-muted">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Comment ça marche ────────────────────────────────────────────── */}
        <section id="comment" className="mx-auto max-w-[1180px] px-6 py-[92px]">
          <div className="max-w-[30em]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-ink">
              Comment ça marche
            </p>
            <h2 className="mt-3.5 font-serif text-[clamp(32px,4vw,52px)] leading-tight tracking-tight">
              Trois étapes pour trouver ta voie.
            </h2>
          </div>

          <div className="mt-12 border-t border-line-strong">
            {STEPS.map((step) => (
              <div
                key={step.number}
                className="grid grid-cols-[60px_1fr] items-start gap-4 border-b border-line py-7 sm:grid-cols-[90px_1fr_auto] sm:gap-7 sm:py-[34px]"
              >
                <div className="font-serif text-[44px] leading-[0.8] text-accent sm:text-[64px]">
                  {step.number}
                </div>
                <div>
                  <h3 className="text-[24px] font-semibold tracking-tight">{step.title}</h3>
                  <p className="mt-2 max-w-[36em] text-ink-soft">{step.body}</p>
                </div>
                <div className="hidden size-[46px] place-items-center rounded-xl border border-line-strong bg-surface sm:grid">
                  <step.Icon className="size-[22px] text-accent-ink" strokeWidth={1.6} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10">
            <Link
              href="/questionnaire"
              className="group inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-[15px] font-semibold text-paper transition hover:bg-accent hover:text-white"
            >
              Commencer maintenant
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </section>

        {/* ── Différenciateurs ─────────────────────────────────────────────── */}
        <section className="mx-auto max-w-[1180px] px-6 py-[92px]">
          <div className="max-w-[30em]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-ink">
              Pourquoi Oryam
            </p>
            <h2 className="mt-3.5 font-serif text-[clamp(32px,4vw,52px)] leading-tight tracking-tight">
              Conçu pour donner de vraies réponses.
            </h2>
          </div>

          <div className="mt-12 grid overflow-hidden rounded-[18px] border border-line bg-surface sm:grid-cols-2">
            {DIFFERENTIATORS.map((item) => (
              <div
                key={item.title}
                className="border-line p-8 [&:not(:last-child)]:border-b sm:[&:nth-child(odd)]:border-r sm:[&:nth-last-child(-n+2)]:border-b-0"
              >
                <div className="mb-[18px] grid size-12 place-items-center rounded-xl bg-accent-soft">
                  <item.Icon className="size-[22px] text-accent-ink" strokeWidth={1.6} />
                </div>
                <h3 className="text-[21px] font-semibold tracking-tight">{item.title}</h3>
                <p className="mt-2.5 text-[15.5px] text-ink-soft">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Témoignages ─────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-[1180px] px-6 py-[92px]">
          <div className="mx-auto max-w-[30em] text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-ink">
              Témoignages
            </p>
            <h2 className="mt-3.5 font-serif text-[clamp(32px,4vw,52px)] leading-tight tracking-tight">
              Ce qu'ils en disent.
            </h2>
          </div>

          <div className="mt-12 grid gap-[18px] sm:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <figure
                key={t.name}
                className="flex flex-col rounded-[18px] border border-line bg-surface p-7"
              >
                <blockquote className="font-serif text-[21px] leading-[1.3] text-ink">
                  «&nbsp;{t.quote}&nbsp;»
                </blockquote>
                <figcaption className="mt-auto flex items-center gap-3 pt-6">
                  <div className="grid size-[42px] flex-none place-items-center rounded-full bg-accent-soft text-[15px] font-semibold text-accent-ink">
                    {t.initials}
                  </div>
                  <div>
                    <div className="text-[14.5px] font-semibold">{t.name}</div>
                    <div className="text-[13px] text-muted">{t.role}</div>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* ── Tarifs ──────────────────────────────────────────────────────── */}
        <section id="tarifs" className="mx-auto max-w-[1180px] px-6 py-[92px]">
          <div className="mx-auto max-w-[34em] text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-ink">
              Tarifs
            </p>
            <h2 className="mt-3.5 font-serif text-[clamp(32px,4vw,52px)] leading-tight tracking-tight">
              Commence gratuitement.
            </h2>
            <p className="mt-3.5 text-[18px] text-ink-soft">
              Aucune carte bancaire pour démarrer. Tu paies seulement si tu veux aller plus loin.
            </p>
          </div>

          <div className="mt-12 grid gap-[22px] sm:grid-cols-[1fr_1.05fr]">
            {/* Gratuit */}
            <div className="rounded-[22px] border border-line-strong bg-surface p-9">
              <p className="text-[13px] uppercase tracking-[0.14em] text-muted">Gratuit</p>
              <p className="mt-3.5 font-serif text-[58px] leading-none">0 €</p>
              <p className="mt-1.5 text-sm text-muted">Pour toujours</p>
              <ul className="my-7 flex flex-col gap-3.5 text-[15px]">
                {[
                  "Questionnaire complet & adaptatif",
                  "Ton portrait IA personnalisé",
                  "Tes 3 premières pistes à swiper",
                  "Fiche personnalisée pour ton #1",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <Check className="mt-0.5 size-[18px] flex-none text-ok" strokeWidth={2} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/questionnaire"
                className="flex w-full items-center justify-center rounded-full border border-line-strong px-6 py-3.5 text-[15px] font-semibold text-ink transition hover:bg-surface-2"
              >
                Démarrer gratuitement
              </Link>
            </div>

            {/* Rapport complet */}
            <div className="relative rounded-[22px] border border-panel bg-panel p-9 text-on-panel">
              <span className="absolute -top-3 right-9 rounded-full bg-accent px-3.5 py-1.5 text-xs font-semibold tracking-wide text-white">
                Recommandé
              </span>
              <p className="text-[13px] uppercase tracking-[0.14em] text-accent">Rapport complet</p>
              <p className="mt-3.5 flex items-baseline gap-2.5 font-serif text-[58px] leading-none">
                5,90 €
                <small className="font-sans text-[15px] font-medium text-on-panel/60">
                  paiement unique
                </small>
              </p>
              <p className="mt-1.5 text-sm text-on-panel/60">Accès immédiat · Sans abonnement</p>
              <ul className="my-7 flex flex-col gap-3.5 text-[15px]">
                {[
                  "Tout ce qui est inclus dans le gratuit",
                  "De nouveaux métiers affinés par l'IA à chaque paquet",
                  "Explication personnalisée sur chaque carte",
                  "Fiche personnalisée pour chaque métier débloqué",
                  "Plan d'action concret : formations, étapes & journée type",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <Check className="mt-0.5 size-[18px] flex-none text-accent" strokeWidth={2} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/questionnaire"
                className="group flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-[15px] font-semibold text-white transition hover:bg-white hover:text-ink"
              >
                Obtenir mon rapport
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </section>

        {/* ── FAQ ─────────────────────────────────────────────────────────── */}
        <section id="faq" className="mx-auto max-w-[760px] px-6 py-[92px]">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-ink">
              FAQ
            </p>
            <h2 className="mt-3.5 font-serif text-[clamp(32px,4vw,52px)] leading-tight tracking-tight">
              Questions fréquentes.
            </h2>
          </div>

          <dl className="mt-10 space-y-3.5">
            {FAQS.map((item) => (
              <details
                key={item.q}
                className="group rounded-[14px] border border-line bg-surface"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 font-medium">
                  {item.q}
                  <ChevronDown className="size-5 flex-none text-muted transition-transform group-open:rotate-180" />
                </summary>
                <p className="border-t border-line px-6 py-4 text-[15px] leading-relaxed text-ink-soft">
                  {item.a}
                </p>
              </details>
            ))}
          </dl>
        </section>

        {/* ── CTA final ───────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-[760px] px-6 py-24 text-center">
          <h2 className="font-serif text-[clamp(32px,4vw,52px)] leading-tight tracking-tight">
            Prêt à trouver ta voie ?
          </h2>
          <p className="mt-4 text-[18px] text-ink-soft">
            5 minutes. Sans inscription. Tes 3 premières pistes sont gratuites.
          </p>
          <Link
            href="/questionnaire"
            className="group mt-8 inline-flex items-center gap-2 rounded-full bg-ink px-8 py-4 text-base font-semibold text-paper transition hover:bg-accent hover:text-white"
          >
            Faire le test gratuitement
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </section>

      </main>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-line bg-surface-2 py-12">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-5 px-6 text-sm text-muted">
          <Logo className="text-[22px]" />
          <nav className="flex flex-wrap gap-[22px]">
            <Link href="/metiers" className="transition-colors hover:text-accent-ink">
              Tous les métiers
            </Link>
            <Link href="/mentions-legales" className="transition-colors hover:text-accent-ink">
              Mentions légales
            </Link>
            <Link href="/confidentialite" className="transition-colors hover:text-accent-ink">
              Confidentialité
            </Link>
            <Link href="/cgv" className="transition-colors hover:text-accent-ink">
              CGV
            </Link>
            <a href="mailto:contact@oryam.fr" className="transition-colors hover:text-accent-ink">
              Contact
            </a>
          </nav>
          <p>© {new Date().getFullYear()} Oryam</p>
        </div>
      </footer>

    </div>
  );
}
