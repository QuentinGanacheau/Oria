import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ThemeToggle from "@/components/theme-toggle";

function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 font-serif tracking-tight ${className}`}>
      FindYour
      <span className="mb-1.5 inline-block size-[9px] rounded-full bg-accent" />
      Job
    </span>
  );
}

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
    <div className="min-h-screen bg-paper text-ink">
      {/* Nav */}
      <header className="border-b border-line bg-paper/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/">
            <Logo className="text-[22px]" />
          </Link>
          <div className="flex items-center gap-3.5">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-ink-soft transition-colors hover:text-accent-ink"
            >
              <ArrowLeft className="size-4" /> Retour à l&apos;accueil
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Contenu */}
      <main className="mx-auto max-w-3xl px-6 py-12 pb-24">
        <p className="text-sm text-muted">
          Dernière mise à jour : {lastUpdated}
        </p>
        <h1 className="mt-2 font-serif text-[clamp(32px,4vw,48px)] leading-tight tracking-tight">
          {title}
        </h1>

        <div className="prose mt-10 max-w-none prose-headings:font-serif prose-headings:font-normal prose-headings:tracking-tight prose-a:text-accent-ink dark:prose-invert">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-line bg-surface-2 px-6 py-8">
        <div className="mx-auto flex max-w-3xl flex-wrap justify-center gap-6 text-sm text-muted">
          <Link href="/mentions-legales" className="transition-colors hover:text-accent-ink">
            Mentions légales
          </Link>
          <Link href="/cgv" className="transition-colors hover:text-accent-ink">
            CGV
          </Link>
          <Link href="/confidentialite" className="transition-colors hover:text-accent-ink">
            Politique de confidentialité
          </Link>
        </div>
      </footer>
    </div>
  );
}
