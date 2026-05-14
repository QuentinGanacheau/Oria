import Link from "next/link";

export default function LegalLayout({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Nav */}
      <header className="border-b border-slate-200/70 bg-white/80 backdrop-blur-md dark:border-slate-800/70 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-indigo-600 dark:text-indigo-400"
          >
            FindYourJob
          </Link>
          <Link
            href="/"
            className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            ← Retour à l&apos;accueil
          </Link>
        </div>
      </header>

      {/* Contenu */}
      <main className="mx-auto max-w-3xl px-6 py-12 pb-24">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Dernière mise à jour : {lastUpdated}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{title}</h1>

        <div className="prose prose-slate mt-10 max-w-none dark:prose-invert">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50 px-6 py-8 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="mx-auto flex max-w-3xl flex-wrap justify-center gap-6 text-sm text-slate-500 dark:text-slate-400">
          <Link href="/mentions-legales" className="hover:text-slate-900 dark:hover:text-white transition-colors">
            Mentions légales
          </Link>
          <Link href="/cgv" className="hover:text-slate-900 dark:hover:text-white transition-colors">
            CGV
          </Link>
          <Link href="/confidentialite" className="hover:text-slate-900 dark:hover:text-white transition-colors">
            Politique de confidentialité
          </Link>
        </div>
      </footer>
    </div>
  );
}
