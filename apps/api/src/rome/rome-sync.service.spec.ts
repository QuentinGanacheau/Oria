import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RomeSyncService } from './rome-sync.service';
import { Prisma } from '@prisma/client';
import type { RomeMetierListItem, RomeMetierDetails } from './rome.types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const apiMock = {
  listMetiers: vi.fn(),
  getMetierDetails: vi.fn(),
  // Par défaut : pas de donnée d'offres (null) — n'altère pas les tests existants.
  countOffersByRome: vi.fn().mockResolvedValue(null),
};

const prismaMock = {
  romeJob: {
    upsert: vi.fn(),
    // finalizeRecruitmentLevels : aucune donnée d'offres par défaut.
    findMany: vi.fn().mockResolvedValue([]),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildListItem(code: string, libelle = `Libelle ${code}`): RomeMetierListItem {
  return { code, libelle };
}

function buildDetails(
  code: string,
  overrides: Partial<RomeMetierDetails> = {},
): RomeMetierDetails {
  return {
    code,
    libelle: `Libelle ${code}`,
    definition: `Définition de ${code}`,
    accesEmploi: 'Bac+2 ou expérience équivalente',
    domaineProfessionnel: {
      code: code.slice(0, 3),
      libelle: `Domaine ${code.slice(0, 3)}`,
      grandDomaine: {
        code: code.charAt(0).toUpperCase(),
        libelle: `Grand domaine ${code.charAt(0).toUpperCase()}`,
      },
    },
    competencesMobiliseesPrincipales: [
      { type: 'COMPETENCE-DETAILLEE', libelle: 'Concevoir une solution' },
    ],
    competencesMobilisees: [
      { type: 'SAVOIR', libelle: 'Connaissance des outils' },
      { type: 'COMPETENCE-DETAILLEE', libelle: 'Analyser un besoin' },
    ],
    contextesTravail: [{ libelle: 'En équipe' }],
    ...overrides,
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('RomeSyncService', () => {
  let service: RomeSyncService;

  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks efface l'historique mais pas les implémentations ; on rétablit
    // explicitement les valeurs par défaut des mocks ajoutés pour la finalisation.
    apiMock.countOffersByRome.mockResolvedValue(null);
    prismaMock.romeJob.findMany.mockResolvedValue([]);
    prismaMock.romeJob.updateMany.mockResolvedValue({ count: 0 });
    // On court-circuite le throttle et le retry-delay pour que les tests
    // s'exécutent instantanément sans jamais appeler de vrai setTimeout.
    vi.useFakeTimers();
    service = new RomeSyncService(apiMock as any, prismaMock as any);
  });

  // ─── Liste vide ─────────────────────────────────────────────────────────────

  describe('liste de métiers vide', () => {
    it('retourne un rapport avec total=0 sans appeler getMetierDetails', async () => {
      apiMock.listMetiers.mockResolvedValue([]);

      const promise = service.syncAll();
      await vi.runAllTimersAsync();
      const report = await promise;

      expect(report.total).toBe(0);
      expect(report.succeeded).toBe(0);
      expect(report.failed).toBe(0);
      expect(apiMock.getMetierDetails).not.toHaveBeenCalled();
      expect(prismaMock.romeJob.upsert).not.toHaveBeenCalled();
    });
  });

  // ─── Sync complète — happy path ──────────────────────────────────────────────

  describe('sync complète — cas nominal', () => {
    it('retourne succeeded égal au nombre de métiers si tout réussit', async () => {
      const list = [buildListItem('M1805'), buildListItem('M1801')];
      apiMock.listMetiers.mockResolvedValue(list);
      apiMock.getMetierDetails
        .mockResolvedValueOnce(buildDetails('M1805'))
        .mockResolvedValueOnce(buildDetails('M1801'));
      prismaMock.romeJob.upsert.mockResolvedValue({});

      const promise = service.syncAll();
      await vi.runAllTimersAsync();
      const report = await promise;

      expect(report.total).toBe(2);
      expect(report.succeeded).toBe(2);
      expect(report.failed).toBe(0);
    });

    it('appelle getMetierDetails une fois par métier de la liste', async () => {
      const list = [buildListItem('M1805'), buildListItem('M1801'), buildListItem('K1302')];
      apiMock.listMetiers.mockResolvedValue(list);
      apiMock.getMetierDetails.mockResolvedValue(buildDetails('M1805'));
      prismaMock.romeJob.upsert.mockResolvedValue({});

      const promise = service.syncAll();
      await vi.runAllTimersAsync();
      await promise;

      expect(apiMock.getMetierDetails).toHaveBeenCalledTimes(3);
      expect(apiMock.getMetierDetails).toHaveBeenCalledWith('M1805');
      expect(apiMock.getMetierDetails).toHaveBeenCalledWith('M1801');
      expect(apiMock.getMetierDetails).toHaveBeenCalledWith('K1302');
    });

    it('appelle upsert une fois par métier traité avec succès', async () => {
      const list = [buildListItem('M1805'), buildListItem('M1801')];
      apiMock.listMetiers.mockResolvedValue(list);
      apiMock.getMetierDetails
        .mockResolvedValueOnce(buildDetails('M1805'))
        .mockResolvedValueOnce(buildDetails('M1801'));
      prismaMock.romeJob.upsert.mockResolvedValue({});

      const promise = service.syncAll();
      await vi.runAllTimersAsync();
      await promise;

      expect(prismaMock.romeJob.upsert).toHaveBeenCalledTimes(2);
    });

    it('upsert avec la clause where sur le code du métier', async () => {
      apiMock.listMetiers.mockResolvedValue([buildListItem('M1805')]);
      apiMock.getMetierDetails.mockResolvedValue(buildDetails('M1805'));
      prismaMock.romeJob.upsert.mockResolvedValue({});

      const promise = service.syncAll();
      await vi.runAllTimersAsync();
      await promise;

      expect(prismaMock.romeJob.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { code: 'M1805' } }),
      );
    });

    it('les blocs create et update contiennent le même payload', async () => {
      apiMock.listMetiers.mockResolvedValue([buildListItem('M1805')]);
      apiMock.getMetierDetails.mockResolvedValue(buildDetails('M1805'));
      prismaMock.romeJob.upsert.mockResolvedValue({});

      const promise = service.syncAll();
      await vi.runAllTimersAsync();
      await promise;

      const call = prismaMock.romeJob.upsert.mock.calls[0][0];
      expect(call.create).toEqual(call.update);
    });

    it('inclut le durationMs dans le rapport', async () => {
      apiMock.listMetiers.mockResolvedValue([buildListItem('M1805')]);
      apiMock.getMetierDetails.mockResolvedValue(buildDetails('M1805'));
      prismaMock.romeJob.upsert.mockResolvedValue({});

      const promise = service.syncAll();
      await vi.runAllTimersAsync();
      const report = await promise;

      expect(typeof report.durationMs).toBe('number');
      expect(report.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ─── Mapping toPrismaData ────────────────────────────────────────────────────

  describe('mapping des données vers Prisma', () => {
    it('mappe correctement les codes domaines depuis la réponse API', async () => {
      apiMock.listMetiers.mockResolvedValue([buildListItem('M1805')]);
      apiMock.getMetierDetails.mockResolvedValue(
        buildDetails('M1805', {
          domaineProfessionnel: {
            code: 'M18',
            libelle: 'Systèmes d information',
            grandDomaine: { code: 'M', libelle: "Support à l'entreprise" },
          },
        }),
      );
      prismaMock.romeJob.upsert.mockResolvedValue({});

      const promise = service.syncAll();
      await vi.runAllTimersAsync();
      await promise;

      const payload = prismaMock.romeJob.upsert.mock.calls[0][0].create;
      expect(payload.code).toBe('M1805');
      expect(payload.codeGrandDomaine).toBe('M');
      expect(payload.libelleGrandDomaine).toBe("Support à l'entreprise");
      expect(payload.codeDomaine).toBe('M18');
      expect(payload.libelleDomaine).toBe('Systèmes d information');
    });

    it('dérive les codes domaines depuis le code métier si domaineProfessionnel est absent', async () => {
      apiMock.listMetiers.mockResolvedValue([buildListItem('M1805')]);
      apiMock.getMetierDetails.mockResolvedValue(
        buildDetails('M1805', { domaineProfessionnel: undefined }),
      );
      prismaMock.romeJob.upsert.mockResolvedValue({});

      const promise = service.syncAll();
      await vi.runAllTimersAsync();
      await promise;

      const payload = prismaMock.romeJob.upsert.mock.calls[0][0].create;
      expect(payload.codeGrandDomaine).toBe('M');
      expect(payload.codeDomaine).toBe('M18');
    });

    it('utilise le libellé de GRAND_DOMAINE_LIBELLES en fallback si grandDomaine.libelle est absent', async () => {
      apiMock.listMetiers.mockResolvedValue([buildListItem('M1805')]);
      apiMock.getMetierDetails.mockResolvedValue(
        buildDetails('M1805', {
          domaineProfessionnel: {
            code: 'M18',
            libelle: 'Systèmes d information',
            grandDomaine: { code: 'M' }, // libelle absent
          },
        }),
      );
      prismaMock.romeJob.upsert.mockResolvedValue({});

      const promise = service.syncAll();
      await vi.runAllTimersAsync();
      await promise;

      const payload = prismaMock.romeJob.upsert.mock.calls[0][0].create;
      expect(payload.libelleGrandDomaine).toBe("Support à l'entreprise");
    });

    it('filtre les compétences de type SAVOIR dans competencesSavoirs', async () => {
      apiMock.listMetiers.mockResolvedValue([buildListItem('M1805')]);
      apiMock.getMetierDetails.mockResolvedValue(
        buildDetails('M1805', {
          competencesMobilisees: [
            { type: 'SAVOIR', libelle: 'Connaissance réseau' },
            { type: 'COMPETENCE-DETAILLEE', libelle: 'Analyser un besoin' },
            { type: 'SAVOIR', libelle: 'Algorithmique' },
          ],
        }),
      );
      prismaMock.romeJob.upsert.mockResolvedValue({});

      const promise = service.syncAll();
      await vi.runAllTimersAsync();
      await promise;

      const payload = prismaMock.romeJob.upsert.mock.calls[0][0].create;
      const savoirs = payload.competencesSavoirs as { type: string; libelle: string }[];
      expect(Array.isArray(savoirs)).toBe(true);
      expect(savoirs).toHaveLength(2);
      expect(savoirs.every((c) => c.type === 'SAVOIR')).toBe(true);
    });

    it('affecte Prisma.JsonNull à competencesSavoirs quand aucune compétence SAVOIR', async () => {
      apiMock.listMetiers.mockResolvedValue([buildListItem('M1805')]);
      apiMock.getMetierDetails.mockResolvedValue(
        buildDetails('M1805', {
          competencesMobilisees: [
            { type: 'COMPETENCE-DETAILLEE', libelle: 'Analyser' },
          ],
        }),
      );
      prismaMock.romeJob.upsert.mockResolvedValue({});

      const promise = service.syncAll();
      await vi.runAllTimersAsync();
      await promise;

      const payload = prismaMock.romeJob.upsert.mock.calls[0][0].create;
      expect(payload.competencesSavoirs).toBe(Prisma.JsonNull);
    });

    it('affecte Prisma.JsonNull à competencesSavoirFaire quand la liste principale est absente', async () => {
      apiMock.listMetiers.mockResolvedValue([buildListItem('M1805')]);
      apiMock.getMetierDetails.mockResolvedValue(
        buildDetails('M1805', { competencesMobiliseesPrincipales: undefined }),
      );
      prismaMock.romeJob.upsert.mockResolvedValue({});

      const promise = service.syncAll();
      await vi.runAllTimersAsync();
      await promise;

      const payload = prismaMock.romeJob.upsert.mock.calls[0][0].create;
      expect(payload.competencesSavoirFaire).toBe(Prisma.JsonNull);
    });

    it('affecte Prisma.JsonNull à contextesTravail quand la liste est absente', async () => {
      apiMock.listMetiers.mockResolvedValue([buildListItem('M1805')]);
      apiMock.getMetierDetails.mockResolvedValue(
        buildDetails('M1805', { contextesTravail: undefined }),
      );
      prismaMock.romeJob.upsert.mockResolvedValue({});

      const promise = service.syncAll();
      await vi.runAllTimersAsync();
      await promise;

      const payload = prismaMock.romeJob.upsert.mock.calls[0][0].create;
      expect(payload.contextesTravail).toBe(Prisma.JsonNull);
    });

    it('affecte Prisma.JsonNull à contextesTravail quand la liste est vide', async () => {
      apiMock.listMetiers.mockResolvedValue([buildListItem('M1805')]);
      apiMock.getMetierDetails.mockResolvedValue(
        buildDetails('M1805', { contextesTravail: [] }),
      );
      prismaMock.romeJob.upsert.mockResolvedValue({});

      const promise = service.syncAll();
      await vi.runAllTimersAsync();
      await promise;

      const payload = prismaMock.romeJob.upsert.mock.calls[0][0].create;
      expect(payload.contextesTravail).toBe(Prisma.JsonNull);
    });

    it('stocke les contextes de travail quand la liste est non vide', async () => {
      const contextes = [{ libelle: 'En équipe' }, { libelle: 'En télétravail' }];
      apiMock.listMetiers.mockResolvedValue([buildListItem('M1805')]);
      apiMock.getMetierDetails.mockResolvedValue(
        buildDetails('M1805', { contextesTravail: contextes }),
      );
      prismaMock.romeJob.upsert.mockResolvedValue({});

      const promise = service.syncAll();
      await vi.runAllTimersAsync();
      await promise;

      const payload = prismaMock.romeJob.upsert.mock.calls[0][0].create;
      expect(payload.contextesTravail).toEqual(contextes);
    });

    it('mappe definition et accesEmploi à null si absents', async () => {
      apiMock.listMetiers.mockResolvedValue([buildListItem('M1805')]);
      apiMock.getMetierDetails.mockResolvedValue(
        buildDetails('M1805', { definition: undefined, accesEmploi: undefined }),
      );
      prismaMock.romeJob.upsert.mockResolvedValue({});

      const promise = service.syncAll();
      await vi.runAllTimersAsync();
      await promise;

      const payload = prismaMock.romeJob.upsert.mock.calls[0][0].create;
      expect(payload.definition).toBeNull();
      expect(payload.accesEmploi).toBeNull();
    });

    it('inclut un champ syncedAt de type Date dans le payload', async () => {
      apiMock.listMetiers.mockResolvedValue([buildListItem('M1805')]);
      apiMock.getMetierDetails.mockResolvedValue(buildDetails('M1805'));
      prismaMock.romeJob.upsert.mockResolvedValue({});

      const promise = service.syncAll();
      await vi.runAllTimersAsync();
      await promise;

      const payload = prismaMock.romeJob.upsert.mock.calls[0][0].create;
      expect(payload.syncedAt).toBeInstanceOf(Date);
    });
  });

  // ─── Gestion des erreurs — API ────────────────────────────────────────────────

  describe('erreurs API', () => {
    it('comptabilise un échec quand listMetiers rejette', async () => {
      apiMock.listMetiers.mockRejectedValue(new Error('Service indisponible'));

      await expect(service.syncAll()).rejects.toThrow('Service indisponible');
    });

    it('comptabilise failed++ et continue si getMetierDetails échoue sur un métier', async () => {
      const list = [buildListItem('M1805'), buildListItem('M1801')];
      apiMock.listMetiers.mockResolvedValue(list);
      apiMock.getMetierDetails
        .mockRejectedValueOnce(new Error('404 Métier introuvable'))
        .mockResolvedValueOnce(buildDetails('M1801'));
      prismaMock.romeJob.upsert.mockResolvedValue({});

      const promise = service.syncAll();
      await vi.runAllTimersAsync();
      const report = await promise;

      expect(report.total).toBe(2);
      expect(report.succeeded).toBe(1);
      expect(report.failed).toBe(1);
    });

    it('comptabilise failed++ et continue si upsert Prisma échoue', async () => {
      const list = [buildListItem('M1805'), buildListItem('M1801')];
      apiMock.listMetiers.mockResolvedValue(list);
      apiMock.getMetierDetails
        .mockResolvedValueOnce(buildDetails('M1805'))
        .mockResolvedValueOnce(buildDetails('M1801'));
      prismaMock.romeJob.upsert
        .mockRejectedValueOnce(new Error('DB connexion perdue'))
        .mockResolvedValueOnce({});

      const promise = service.syncAll();
      await vi.runAllTimersAsync();
      const report = await promise;

      expect(report.total).toBe(2);
      expect(report.succeeded).toBe(1);
      expect(report.failed).toBe(1);
    });

    it('un échec sur un métier ne bloque pas le traitement des suivants', async () => {
      const list = [buildListItem('M1805'), buildListItem('M1801'), buildListItem('K1302')];
      apiMock.listMetiers.mockResolvedValue(list);
      apiMock.getMetierDetails
        .mockRejectedValueOnce(new Error('500 Erreur serveur'))
        .mockResolvedValueOnce(buildDetails('M1801'))
        .mockResolvedValueOnce(buildDetails('K1302'));
      prismaMock.romeJob.upsert.mockResolvedValue({});

      const promise = service.syncAll();
      await vi.runAllTimersAsync();
      const report = await promise;

      expect(report.succeeded).toBe(2);
      expect(report.failed).toBe(1);
      // Les deux métiers suivants ont bien été traités
      expect(prismaMock.romeJob.upsert).toHaveBeenCalledTimes(2);
    });
  });

  // ─── Retry sur erreur 429 ──────────────────────────────────────────────────

  describe('retry sur rate limit 429', () => {
    it('retente jusqu à MAX_RETRIES fois sur une erreur 429', async () => {
      apiMock.listMetiers.mockResolvedValue([buildListItem('M1805')]);
      // Deux 429 consécutifs puis succès
      apiMock.getMetierDetails
        .mockRejectedValueOnce(new Error('France Travail API 429 sur /metier/M1805.'))
        .mockRejectedValueOnce(new Error('France Travail API 429 sur /metier/M1805.'))
        .mockResolvedValueOnce(buildDetails('M1805'));
      prismaMock.romeJob.upsert.mockResolvedValue({});

      const promise = service.syncAll();
      await vi.runAllTimersAsync();
      const report = await promise;

      expect(report.succeeded).toBe(1);
      expect(report.failed).toBe(0);
      expect(apiMock.getMetierDetails).toHaveBeenCalledTimes(3);
    });

    it('comptabilise failed après MAX_RETRIES tentatives infructueuses sur 429', async () => {
      apiMock.listMetiers.mockResolvedValue([buildListItem('M1805')]);
      // 3 erreurs 429 consécutives (= MAX_RETRIES)
      apiMock.getMetierDetails.mockRejectedValue(
        new Error('France Travail API 429 trop de requêtes'),
      );
      prismaMock.romeJob.upsert.mockResolvedValue({});

      const promise = service.syncAll();
      await vi.runAllTimersAsync();
      const report = await promise;

      expect(report.failed).toBe(1);
      expect(report.succeeded).toBe(0);
      expect(apiMock.getMetierDetails).toHaveBeenCalledTimes(3); // MAX_RETRIES = 3
    });

    it('ne retente pas sur une erreur non-429 (ex: 404)', async () => {
      apiMock.listMetiers.mockResolvedValue([buildListItem('M1805')]);
      apiMock.getMetierDetails.mockRejectedValue(new Error('France Travail API 404 introuvable'));
      prismaMock.romeJob.upsert.mockResolvedValue({});

      const promise = service.syncAll();
      await vi.runAllTimersAsync();
      const report = await promise;

      expect(report.failed).toBe(1);
      // 1 seule tentative — pas de retry sur 404
      expect(apiMock.getMetierDetails).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Indicateur de recrutement ──────────────────────────────────────────────

  describe('comptage des offres et paliers de recrutement', () => {
    it('appelle countOffersByRome une fois par métier et stocke offerCount', async () => {
      apiMock.listMetiers.mockResolvedValue([buildListItem('M1805')]);
      apiMock.getMetierDetails.mockResolvedValue(buildDetails('M1805'));
      apiMock.countOffersByRome.mockResolvedValue(1234);
      prismaMock.romeJob.upsert.mockResolvedValue({});

      const promise = service.syncAll();
      await vi.runAllTimersAsync();
      await promise;

      expect(apiMock.countOffersByRome).toHaveBeenCalledWith('M1805');
      const payload = prismaMock.romeJob.upsert.mock.calls[0][0].create;
      expect(payload.offerCount).toBe(1234);
    });

    it('stocke offerCount = null si le comptage est indisponible', async () => {
      apiMock.listMetiers.mockResolvedValue([buildListItem('M1805')]);
      apiMock.getMetierDetails.mockResolvedValue(buildDetails('M1805'));
      apiMock.countOffersByRome.mockResolvedValue(null);
      prismaMock.romeJob.upsert.mockResolvedValue({});

      const promise = service.syncAll();
      await vi.runAllTimersAsync();
      await promise;

      const payload = prismaMock.romeJob.upsert.mock.calls[0][0].create;
      expect(payload.offerCount).toBeNull();
    });

    it('calcule les paliers par percentile sur les compteurs positifs', async () => {
      apiMock.listMetiers.mockResolvedValue([buildListItem('M1805')]);
      apiMock.getMetierDetails.mockResolvedValue(buildDetails('M1805'));
      prismaMock.romeJob.upsert.mockResolvedValue({});
      // Distribution contrôlée : p33 → seuil 40 (medium), p66 → seuil 70 (high).
      prismaMock.romeJob.findMany.mockResolvedValue(
        [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((offerCount) => ({
          offerCount,
        })),
      );

      const promise = service.syncAll();
      await vi.runAllTimersAsync();
      await promise;

      const calls = prismaMock.romeJob.updateMany.mock.calls.map((c) => c[0]);
      const high = calls.find((c) => c.data.recruitmentLevel === 'high');
      const medium = calls.find((c) => c.data.recruitmentLevel === 'medium');
      const low = calls.find((c) => c.data.recruitmentLevel === 'low');

      expect(high.where.offerCount).toEqual({ gte: 70 });
      expect(medium.where.offerCount).toEqual({ gte: 40, lt: 70 });
      expect(low.where.offerCount).toEqual({ not: null, lt: 40 });
    });

    it('ne calcule aucun palier si aucune offre positive (reset à null)', async () => {
      apiMock.listMetiers.mockResolvedValue([buildListItem('M1805')]);
      apiMock.getMetierDetails.mockResolvedValue(buildDetails('M1805'));
      prismaMock.romeJob.upsert.mockResolvedValue({});
      prismaMock.romeJob.findMany.mockResolvedValue([
        { offerCount: 0 },
        { offerCount: null },
      ]);

      const promise = service.syncAll();
      await vi.runAllTimersAsync();
      await promise;

      // Un seul updateMany : remise à null globale (sans where), pas de leveling.
      expect(prismaMock.romeJob.updateMany).toHaveBeenCalledTimes(1);
      const [arg] = prismaMock.romeJob.updateMany.mock.calls[0];
      expect(arg.where).toBeUndefined();
      expect(arg.data).toEqual({ recruitmentLevel: null });
    });
  });

  // ─── Contenu du rapport final ──────────────────────────────────────────────

  describe('structure du rapport', () => {
    it('total = succeeded + failed dans tous les cas', async () => {
      const list = [
        buildListItem('M1805'),
        buildListItem('M1801'),
        buildListItem('K1302'),
      ];
      apiMock.listMetiers.mockResolvedValue(list);
      apiMock.getMetierDetails
        .mockResolvedValueOnce(buildDetails('M1805'))
        .mockRejectedValueOnce(new Error('500'))
        .mockResolvedValueOnce(buildDetails('K1302'));
      prismaMock.romeJob.upsert.mockResolvedValue({});

      const promise = service.syncAll();
      await vi.runAllTimersAsync();
      const report = await promise;

      expect(report.total).toBe(report.succeeded + report.failed);
    });
  });
});
