import type { NextConfig } from "next";
import path from "path";

/** Racine du monorepo (npm lance le script depuis `apps/web`). */
const monorepoRoot = path.resolve(process.cwd(), "../..");

const nextConfig: NextConfig = {
  outputFileTracingRoot: monorepoRoot,
};

export default nextConfig;
