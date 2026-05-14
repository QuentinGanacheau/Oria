import Link from "next/link";

// ─── Data ─────────────────────────────────────────────────────────────────────

const STEPS = [
  {
    number: "01",
    title: "Tu parles de toi",
    body: "Le questionnaire s'adapte à ton profil en temps réel : lycéen, étudiant, salarié en reconversion… chaque parcours est différent.",
  },
  {
    number: "02",
    title: "L'IA analyse ton profil",
    body: "Tes réponses sont croisées avec 20 métiers. L'intelligence artificielle identifie ce qui te correspond vraiment — pas juste les mots-clés.",
  },
  {
    number: "03",
    title: "Tu découvres tes pistes",
    body: "Un classement personnalisé avec pour chaque métier : ton score d'adéquation et l'explication précise qui justifie le match.",
  },
];

const DIFFERENTIATORS = [
  {
    icon: "🎯",
    title: "Un classement, pas une liste",
    body: "Chaque métier a un score calculé à partir de tes réponses. Tu sais pourquoi il est en #1 — pas juste qu'il y est.",
  },
  {
    icon: "🧠",
    title: "Des questions qui s'adaptent",
    body: "Pas de questionnaire générique à 80 cases. Les questions changent selon ce que tu as déjà répondu pour aller à l'essentiel.",
  },
  {
    icon: "✍️",
    title: "Exprime-toi librement",
    body: "Tu peux écrire tes passions, tes contraintes, ce que tu refuses. L'IA lit entre les lignes, pas juste les cases cochées.",
  },
  {
    icon: "📋",
    title: "Des fiches vraiment personnalisées",
    body: "La fiche de ton #1 résultat est rédigée pour toi : ce qui va te plaire, les points de vigilance, et 3 étapes concrètes à faire maintenant.",
  },
];

const TESTIMONIALS = [
  {
    quote: "J'avais fait des dizaines de tests d'orientation. Celui-là est le premier à m'avoir donné une explication qui tenait la route.",
    name: "Camille R.",
    role: "Étudiante en L2, en réorientation",
  },
  {
    quote: "En reconversion après 8 ans dans la finance. Le classement m'a confirmé ce que je ressentais — et m'a donné les mots pour en parler.",
    name: "Thomas M.",
    role: "35 ans, en reconversion",
  },
  {
    quote: "Rapide, pertinent, sans bullshit. J'ai partagé le lien à tous mes potes qui galèrent avec Parcoursup.",
    name: "Léa D.",
    role: "Terminale, en pleine recherche",
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">

      {/* ── Navigation ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur-md dark:border-slate-800/70 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-lg font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
            FindYourJob
          </span>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300 sm:flex">
            <a href="#comment" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Comment ça marche
            </a>
            <a href="#tarifs" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Tarifs
            </a>
            <a href="#faq" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              FAQ
            </a>
          </nav>
          <Link
            href="/questionnaire"
            className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
          >
            Faire le test →
          </Link>
        </div>
      </header>

      <main>

        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-slate-50 px-6 pb-24 pt-20 dark:from-indigo-950/30 dark:via-slate-950 dark:to-slate-950">
          {/* Déco de fond */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-indigo-200/30 blur-3xl dark:bg-indigo-900/20"
          />

          <div className="relative mx-auto max-w-3xl text-center">
            <span className="inline-block rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300">
              Orientation & Reconversion
            </span>

            <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Découvre les métiers{" "}
              <span className="text-indigo-600 dark:text-indigo-400">
                qui te correspondent vraiment
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">
              Un questionnaire intelligent analyse tes valeurs, ta personnalité et
              tes ambitions. En quelques minutes, tu obtiens un classement
              personnalisé avec les explications qui vont avec.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/questionnaire"
                className="rounded-full bg-indigo-600 px-8 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-indigo-500 hover:shadow-indigo-200 hover:shadow-xl dark:hover:shadow-indigo-900"
              >
                Faire le test gratuitement →
              </Link>
              <a
                href="#comment"
                className="rounded-full border border-slate-300 bg-white px-8 py-4 text-base font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Comment ça marche
              </a>
            </div>

            <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
              ✓ Gratuit &nbsp;·&nbsp; ✓ Sans inscription &nbsp;·&nbsp; ✓ 3 résultats offerts
            </p>
          </div>
        </section>

        {/* ── Bande de confiance ──────────────────────────────────────────── */}
        <section className="border-y border-slate-100 bg-slate-50 px-6 py-8 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-8 text-sm font-medium text-slate-500 dark:text-slate-400">
            {[
              { value: "20", label: "métiers analysés" },
              { value: "5 min", label: "en moyenne" },
              { value: "3", label: "résultats gratuits" },
              { value: "IA", label: "personnalisation poussée" },
            ].map((stat) => (
              <div key={stat.label} className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {stat.value}
                </span>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Problème ────────────────────────────────────────────────────── */}
        <section className="px-6 py-20">
          <div className="mx-auto max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              Le problème
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Les tests d'orientation classiques ne marchent pas
            </h2>
            <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
              Tu as probablement déjà essayé. Et tu sais ce que tu obtiens.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                {
                  emoji: "📋",
                  title: "Des listes sans explication",
                  body: "40 métiers qui \"correspondent à ton profil\"... sans te dire pourquoi ni lequel prioriser.",
                },
                {
                  emoji: "🤷",
                  title: "Des conseils trop génériques",
                  body: "\"Tu aimes travailler avec les gens ? Tu pourrais être commercial, RH ou formateur.\" Très utile.",
                },
                {
                  emoji: "😶",
                  title: "Aucune place pour s'exprimer",
                  body: "Cases à cocher, boutons radio, mais jamais la possibilité de dire ce qui compte vraiment pour toi.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-red-100 bg-red-50/60 p-5 dark:border-red-900/30 dark:bg-red-950/20"
                >
                  <span className="text-2xl">{item.emoji}</span>
                  <h3 className="mt-3 font-semibold text-slate-800 dark:text-slate-100">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Comment ça marche ────────────────────────────────────────────── */}
        <section
          id="comment"
          className="bg-slate-50 px-6 py-20 dark:bg-slate-900/40"
        >
          <div className="mx-auto max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              Comment ça marche
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              3 étapes pour trouver ta voie
            </h2>

            <div className="mt-12 space-y-6">
              {STEPS.map((step) => (
                <div
                  key={step.number}
                  className="flex gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <span className="shrink-0 text-4xl font-black text-indigo-100 dark:text-indigo-900">
                    {step.number}
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold">{step.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                      {step.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 text-center">
              <Link
                href="/questionnaire"
                className="inline-block rounded-full bg-indigo-600 px-8 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-indigo-500"
              >
                Commencer maintenant →
              </Link>
            </div>
          </div>
        </section>

        {/* ── Ce qui est différent ─────────────────────────────────────────── */}
        <section className="px-6 py-20">
          <div className="mx-auto max-w-4xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              Pourquoi FindYourJob
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Conçu pour donner de vraies réponses
            </h2>

            <div className="mt-12 grid gap-6 sm:grid-cols-2">
              {DIFFERENTIATORS.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <span className="text-3xl">{item.icon}</span>
                  <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Témoignages ─────────────────────────────────────────────────── */}
        <section className="bg-indigo-50 px-6 py-20 dark:bg-indigo-950/20">
          <div className="mx-auto max-w-4xl">
            <p className="text-center text-sm font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              Témoignages
            </p>
            <h2 className="mt-3 text-center text-3xl font-bold tracking-tight sm:text-4xl">
              Ce qu'ils en disent
            </h2>

            <div className="mt-12 grid gap-6 sm:grid-cols-3">
              {TESTIMONIALS.map((t) => (
                <figure
                  key={t.name}
                  className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm dark:border-indigo-900/30 dark:bg-slate-900"
                >
                  <blockquote>
                    <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                      &ldquo;{t.quote}&rdquo;
                    </p>
                  </blockquote>
                  <figcaption className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                    <p className="text-sm font-semibold">{t.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t.role}</p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* ── Tarifs ──────────────────────────────────────────────────────── */}
        <section id="tarifs" className="px-6 py-20">
          <div className="mx-auto max-w-3xl">
            <p className="text-center text-sm font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              Tarifs
            </p>
            <h2 className="mt-3 text-center text-3xl font-bold tracking-tight sm:text-4xl">
              Commence gratuitement
            </h2>
            <p className="mt-4 text-center text-slate-600 dark:text-slate-300">
              Aucune carte bancaire pour démarrer. Tu paies seulement si tu veux aller plus loin.
            </p>

            <div className="mt-12 grid gap-6 sm:grid-cols-2">
              {/* Gratuit */}
              <div className="rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Gratuit
                </p>
                <p className="mt-2 text-4xl font-black">0 €</p>
                <p className="mt-1 text-sm text-slate-500">Pour toujours</p>
                <ul className="mt-8 space-y-3 text-sm">
                  {[
                    "Questionnaire complet & adaptatif",
                    "3 premiers résultats de ton classement",
                    "Explication IA pour chaque résultat",
                    "Fiche métier personnalisée pour ton #1",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span className="mt-0.5 shrink-0 text-emerald-500">✓</span>
                      <span className="text-slate-700 dark:text-slate-300">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/questionnaire"
                  className="mt-8 block rounded-full border border-indigo-600 px-6 py-3 text-center text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50 dark:hover:bg-indigo-950"
                >
                  Démarrer gratuitement
                </Link>
              </div>

              {/* Rapport complet */}
              <div className="relative rounded-2xl border-2 border-indigo-600 bg-indigo-600 p-8 text-white shadow-xl shadow-indigo-200 dark:shadow-indigo-900/50">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-400 px-4 py-1 text-xs font-bold uppercase tracking-wide text-slate-900">
                  Recommandé
                </div>
                <p className="text-sm font-semibold uppercase tracking-wide text-indigo-200">
                  Rapport complet
                </p>
                <div className="mt-2 flex items-baseline gap-1">
                  <p className="text-4xl font-black">9,90 €</p>
                  <p className="text-sm text-indigo-200">paiement unique</p>
                </div>
                <p className="mt-1 text-sm text-indigo-200">Accès immédiat · Sans abonnement</p>
                <ul className="mt-8 space-y-3 text-sm">
                  {[
                    "Tout ce qui est inclus dans le gratuit",
                    "Classement complet (tous les métiers)",
                    "Fiche personnalisée pour chaque métier",
                    "Points forts, vigilance & étapes concrètes",
                    "Journée type adaptée à ton profil",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span className="mt-0.5 shrink-0 text-indigo-200">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/questionnaire"
                  className="mt-8 block rounded-full bg-white px-6 py-3 text-center text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50"
                >
                  Obtenir mon rapport →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ─────────────────────────────────────────────────────────── */}
        <section
          id="faq"
          className="bg-slate-50 px-6 py-20 dark:bg-slate-900/40"
        >
          <div className="mx-auto max-w-2xl">
            <p className="text-center text-sm font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              FAQ
            </p>
            <h2 className="mt-3 text-center text-3xl font-bold tracking-tight">
              Questions fréquentes
            </h2>

            <dl className="mt-10 space-y-4">
              {FAQS.map((item) => (
                <details
                  key={item.q}
                  className="group rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 font-medium">
                    {item.q}
                    <span className="shrink-0 text-slate-400 transition group-open:rotate-180">
                      ▾
                    </span>
                  </summary>
                  <p className="border-t border-slate-100 px-6 py-4 text-sm leading-relaxed text-slate-600 dark:border-slate-700 dark:text-slate-300">
                    {item.a}
                  </p>
                </details>
              ))}
            </dl>
          </div>
        </section>

        {/* ── CTA Final ───────────────────────────────────────────────────── */}
        <section className="px-6 py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Prêt à trouver ta voie ?
            </h2>
            <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
              5 minutes. Sans inscription. Tes 3 premiers résultats sont gratuits.
            </p>
            <Link
              href="/questionnaire"
              className="mt-8 inline-block rounded-full bg-indigo-600 px-10 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-indigo-500 hover:shadow-indigo-200 hover:shadow-xl dark:hover:shadow-indigo-900"
            >
              Faire le test gratuitement →
            </Link>
          </div>
        </section>

      </main>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 bg-slate-50 px-6 py-10 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 text-sm text-slate-500 sm:flex-row dark:text-slate-400">
          <span className="font-semibold text-indigo-600 dark:text-indigo-400">
            FindYourJob
          </span>
          <nav className="flex flex-wrap justify-center gap-6">
            <Link href="/mentions-legales" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Mentions légales
            </Link>
            <Link href="/confidentialite" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Politique de confidentialité
            </Link>
            <Link href="/cgv" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              CGV
            </Link>
            <a href="mailto:contact@findyourjob.fr" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Contact
            </a>
          </nav>
          <p>© {new Date().getFullYear()} FindYourJob</p>
        </div>
      </footer>

    </div>
  );
}
