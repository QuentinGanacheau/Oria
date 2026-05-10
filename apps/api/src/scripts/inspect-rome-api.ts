/**
 * Script de diagnostic : récupère un métier ROME en raw et affiche
 * la structure complète de la réponse API.
 *
 * Permet de comprendre les vrais noms de champs renvoyés (qui peuvent
 * différer de ce que la doc laisse penser).
 *
 * Usage : tsx src/scripts/inspect-rome-api.ts [CODE_ROME]
 *         (par défaut : M1805 — développement informatique)
 */
import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { config as loadDotenv } from 'dotenv';
import { RomeAuthService } from '../rome/rome-auth.service';
import { RomeConfig } from '../rome/rome.config';

loadDotenv();

async function main(): Promise<void> {
  const code = process.argv[2] ?? 'M1805';

  const configService = new ConfigService();
  const romeConfig = new RomeConfig(configService);
  const auth = new RomeAuthService(romeConfig);

  const token = await auth.getAccessToken();
  const url = `${romeConfig.apiBaseUrl}/rome-metiers/v1/metiers/metier/${encodeURIComponent(code)}`;

  console.log(`Fetch ${url}\n`);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`HTTP ${response.status}\n${body}`);
    process.exit(1);
  }

  const data = await response.json();

  console.log(`=== Champs racine pour ${code} ===`);
  for (const key of Object.keys(data as object)) {
    const value = (data as Record<string, unknown>)[key];
    const type = Array.isArray(value)
      ? `Array(${value.length})`
      : value === null
        ? 'null'
        : typeof value;
    console.log(`  ${key.padEnd(35)} ${type}`);
  }

  console.log('\n=== JSON complet ===');
  console.log(JSON.stringify(data, null, 2));
}

void main().catch((error) => {
  console.error('Erreur :', error);
  process.exit(1);
});
