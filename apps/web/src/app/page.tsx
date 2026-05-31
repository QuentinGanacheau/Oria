import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Brain,
  Check,
  ChevronDown,
  ClipboardCheck,
  Lock,
  PenLine,
  Target,
  User,
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
    title: "L'IA analyse ton profil",
    body: "Tes réponses sont croisées avec 20 métiers. L'intelligence artificielle identifie ce qui te correspond vraiment — pas juste les mots-clés.",
    Icon: Brain,
  },
  {
    number: "03",
    title: "Tu découvres tes pistes",
    body: "Un classement personnalisé avec pour chaque métier : ton score d'adéquation et l'explication précise qui justifie le match.",
    Icon: BarChart3,
  },
];

const DIFFERENTIATORS = [
  {
    Icon: Target,
    title: "Un classement, pas une liste",
    body: "Chaque métier a un score calculé à partir de tes réponses. Tu sais pourquoi il est en #1 — pas juste qu'il y est.",
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
    body: "La fiche de ton #1 résultat est rédigée pour toi : ce qui va te plaire, les points de vigilance, et 3 étapes concrètes à faire maintenant.",
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
    quote: "En reconversion après 8 ans dans la finance. Le classement m'a confirmé ce que je ressentais — et m'a donné les mots pour en parler.",
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
    a: "Oui. Les 3 premiers résultats de ton classement sont gratuits, sans inscription. Le rapport complet (tous les métiers + fiches personnalisées) est disponible en paiement unique.",
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
    q: "Le rapport complet, c'est quoi exactement ?",
    a: "L'accès à l'intégralité de ton classement + pour chaque métier une fiche personnalisée : ce qui va te plaire dans ce métier selon ton profil, les points de vigilance, 3 étapes concrètes adaptées à ta situation, et une journée type.",
  },
];

const MOCK_JOBS = [
  { rank: "1", title: "UX / Product Designer", sub: "Conception, créativité, impact concret", score: 94 },
  { rank: "2", title: "Chef·fe de projet digital", sub: "Coordination, autonomie, équipe", score: 89 },
  { rank: "3", title: "Data Analyst", sub: "Logique, analyse, résolution", score: 86 },
];

// ─── Primitives ─────────────────────────────────────────────────────────────

function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 font-serif tracking-tight ${className}`}>
      FindYour
      <span className="mb-1.5 inline-block size-[9px] rounded-full bg-accent" />
      Job
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <div className="min-h-screen bg-paper text-ink">

      {/* ── Navigation ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-line bg-paper/80 backdrop-blur-md">
        <div className="mx-auto flex h-[70px] max-w-[1180px] items-center justify-between px-6">
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
          </nav>
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
                tes ambitions. En quelques minutes, tu obtiens un classement
                personnalisé — avec l'explication précise qui justifie chaque résultat.
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
                {["Gratuit", "Sans inscription", "3 résultats offerts"].map((t) => (
                  <span key={t} className="inline-flex items-center gap-2">
                    <Check className="size-4 text-ok" strokeWidth={2.2} />
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Mockup de classement */}
            <div className="overflow-hidden rounded-[22px] border border-line-strong bg-surface shadow-[0_30px_60px_-30px_rgba(40,30,15,.35)] [transform:rotate(.4deg)]">
              <div className="flex items-center justify-between border-b border-line bg-surface-2 px-5 py-4">
                <span className="text-[13px] font-semibold uppercase tracking-wide text-muted">
                  Ton classement
                </span>
                <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-ink">
                  Personnalisé
                </span>
              </div>
              <div className="px-4 pb-4 pt-3.5">
                {MOCK_JOBS.map((job, i) => (
                  <div
                    key={job.rank}
                    className={`flex items-center gap-3.5 rounded-[14px] border px-3.5 py-3.5 ${
                      i === 0
                        ? "border-accent/25 bg-accent-soft"
                        : "border-transparent"
                    } ${i > 0 ? "mt-1" : ""}`}
                  >
                    <div
                      className={`w-[34px] flex-none text-center font-serif text-[30px] ${
                        i === 0 ? "text-accent" : "text-line-strong"
                      }`}
                    >
                      {job.rank}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-semibold tracking-tight">{job.title}</div>
                      <div className="mt-0.5 text-[12.5px] text-muted">{job.sub}</div>
                    </div>
                    <div className="flex-none text-right">
                      <div className={`font-serif text-[26px] leading-none ${i === 0 ? "" : "text-ink-soft"}`}>
                        {job.score}
                        <span className="text-[14px]">%</span>
                      </div>
                      <div className="mt-1.5 h-[5px] w-[76px] overflow-hidden rounded-full bg-line">
                        <i
                          className={`block h-full rounded-full ${i === 0 ? "bg-accent" : "bg-line-strong"}`}
                          style={{ width: `${job.score}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2.5 border-t border-dashed border-line-strong bg-surface-2 px-4 py-3 text-[13px] text-muted">
                <Lock className="size-[15px]" strokeWidth={1.7} />
                + 17 métiers dans ton rapport complet
              </div>
            </div>
          </div>
        </section>

        {/* ── Bande stats ─────────────────────────────────────────────────── */}
        <section className="border-y border-line bg-surface-2">
          <div className="mx-auto flex max-w-[1180px] flex-wrap px-6 py-6">
            {[
              { value: "20", label: "métiers analysés" },
              { value: "5 min", label: "en moyenne" },
              { value: "3", label: "résultats gratuits" },
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
              Pourquoi FindYourJob
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
                  "Tes 3 premiers résultats",
                  "Explication IA pour chaque résultat",
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
                9,90 €
                <small className="font-sans text-[15px] font-medium text-on-panel/60">
                  paiement unique
                </small>
              </p>
              <p className="mt-1.5 text-sm text-on-panel/60">Accès immédiat · Sans abonnement</p>
              <ul className="my-7 flex flex-col gap-3.5 text-[15px]">
                {[
                  "Tout ce qui est inclus dans le gratuit",
                  "Classement complet (tous les métiers)",
                  "Fiche personnalisée pour chaque métier",
                  "Points forts, vigilance & étapes concrètes",
                  "Journée type adaptée à ton profil",
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
            5 minutes. Sans inscription. Tes 3 premiers résultats sont gratuits.
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
            <Link href="/mentions-legales" className="transition-colors hover:text-accent-ink">
              Mentions légales
            </Link>
            <Link href="/confidentialite" className="transition-colors hover:text-accent-ink">
              Confidentialité
            </Link>
            <Link href="/cgv" className="transition-colors hover:text-accent-ink">
              CGV
            </Link>
            <a href="mailto:contact@findyourjob.fr" className="transition-colors hover:text-accent-ink">
              Contact
            </a>
          </nav>
          <p>© {new Date().getFullYear()} FindYourJob</p>
        </div>
      </footer>

    </div>
  );
}
