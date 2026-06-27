import type { NextConfig } from "next";
import path from "path";

/** Racine du monorepo (npm lance le script depuis `apps/web`). */
const monorepoRoot = path.resolve(process.cwd(), "../..");

const nextConfig: NextConfig = {
  outputFileTracingRoot: monorepoRoot,
  // ESLint ne doit pas bloquer le build de production : les erreurs de style
  // (apostrophes non échappées, etc.) relèvent du linting, pas de la
  // compilation. Le lint reste lançable via `npm run lint` en local/CI.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
