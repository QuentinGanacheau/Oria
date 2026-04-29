/**
 * Script CLI : backfill des champs `codeGrandDomaine`, `libelleGrandDomaine`
 * et `codeDomaine` pour les RomeJob déjà en base dont ces champs sont null.
 *
 * Cas d'usage : la première sync n'a pas extrait ces champs depuis l'API
 * (mapping incorrect). On les dérive du code ROME lui-même — c'est une
 * propriété garantie de la nomenclature, donc 100% fiable.
 *
 * Usage : npm run backfill:rome-domains
 *         (ou : tsx src/scripts/backfill-rome-domains.ts)
 */
import 'reflect-metadata';
import { PrismaClient } from '@prisma/client';
import {
  GRAND_DOMAINE_LIBELLES,
  deriveDomaineCode,
  deriveGrandDomaineCode,
} from '../rome/rome.constants';

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const jobs = await prisma.romeJob.findMany({
      where: { codeGrandDomaine: null },
      select: { id: true, code: true },
    });

    if (jobs.length === 0) {
      console.log('✓ Aucun métier à backfiller — tout est déjà à jour.');
      return;
    }

    console.log(`Backfill de ${jobs.length} métiers…`);

    let updated = 0;
    let skipped = 0;

    for (const job of jobs) {
      const codeGrandDomaine = deriveGrandDomaineCode(job.code);
      if (!codeGrandDomaine) {
        skipped++;
        continue;
      }

      const libelleGrandDomaine = GRAND_DOMAINE_LIBELLES[codeGrandDomaine] ?? null;
      const codeDomaine = deriveDomaineCode(job.code);

      await prisma.romeJob.update({
        where: { id: job.id },
        data: { codeGrandDomaine, libelleGrandDomaine, codeDomaine },
      });

      updated++;
      if (updated % 200 === 0) {
        console.log(`  ${updated} / ${jobs.length}`);
      }
    }

    console.log(`\n✓ ${updated} métiers mis à jour.`);
    if (skipped > 0) {
      console.log(`  ${skipped} ignorés (premier caractère hors A-N).`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error('Erreur :', error);
  process.exit(1);
});
