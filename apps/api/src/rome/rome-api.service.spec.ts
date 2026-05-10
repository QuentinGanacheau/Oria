import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RomeApiService } from './rome-api.service';
import type { RomeMetierListItem, RomeMetierDetails } from './rome.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const buildMetierListItem = (
  code = 'M1805',
  libelle = 'Études et développements informatiques',
): RomeMetierListItem => ({ code, libelle });

const buildMetierDetails = (
  code = 'M1805',
  libelle = 'Études et développements informatiques',
): RomeMetierDetails => ({
  code,
  libelle,
  definition: 'Conception et développement de logiciels.',
  accesEmploi: 'Bac +2 minimum',
  domaineProfessionnel: {
    code: 'M18',
    libelle: 'Informatique',
    grandDomaine: { code: 'M', libelle: "Support à l'entreprise" },
  },
  competencesMobiliseesPrincipales: [
    { libelle: 'Concevoir une application web', type: 'COMPETENCE-DETAILLEE' },
  ],
  competencesMobilisees: [
    { libelle: 'Concevoir une application web', type: 'COMPETENCE-DETAILLEE' },
    { libelle: 'Application web', type: 'SAVOIR' },
  ],
  contextesTravail: [{ libelle: 'Open space', categorie: 'environnement' }],
});

// ─── Mocks ────────────────────────────────────────────────────────────────────

const authMock = {
  getAccessToken: vi.fn<[], Promise<string>>(),
};

const configMock = {
  apiBaseUrl: 'https://api.francetravail.io/partenaire',
};

// ─── Utilitaire : simule une réponse fetch ────────────────────────────────────

function mockFetchOk(body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    }),
  );
}

function mockFetchError(status: number, body = 'Erreur serveur'): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: false,
      status,
      text: () => Promise.resolve(body),
    }),
  );
}

function mockFetchNetworkError(message = 'Network failure'): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockRejectedValue(new Error(message)),
  );
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('RomeApiService', () => {
  let service: RomeApiService;

  beforeEach(() => {
    vi.clearAllMocks();
    authMock.getAccessToken.mockResolvedValue('token-valide');
    service = new RomeApiService(authMock as any, configMock as any);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ─── listMetiers ────────────────────────────────────────────────────────────

  describe('listMetiers', () => {
    it('retourne la liste des métiers fournie par l API', async () => {
      const payload: RomeMetierListItem[] = [
        buildMetierListItem('M1805', 'Études informatique'),
        buildMetierListItem('M1801', 'Architecture SI'),
      ];
      mockFetchOk(payload);

      const result = await service.listMetiers();

      expect(result).toEqual(payload);
    });

    it('appelle le bon endpoint avec le header Authorization', async () => {
      mockFetchOk([]);

      await service.listMetiers();

      expect(fetch).toHaveBeenCalledWith(
        'https://api.francetravail.io/partenaire/rome-metiers/v1/metiers/metier',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer token-valide',
          }),
        }),
      );
    });

    it('envoie le header Accept application/json', async () => {
      mockFetchOk([]);

      await service.listMetiers();

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: 'application/json',
          }),
        }),
      );
    });

    it('demande un token via RomeAuthService avant chaque appel', async () => {
      mockFetchOk([]);

      await service.listMetiers();

      expect(authMock.getAccessToken).toHaveBeenCalledOnce();
    });

    it('retourne un tableau vide si l API renvoie une liste vide', async () => {
      mockFetchOk([]);

      const result = await service.listMetiers();

      expect(result).toEqual([]);
    });

    it('propage une erreur si l API répond avec un statut 401', async () => {
      mockFetchError(401, 'Unauthorized');

      await expect(service.listMetiers()).rejects.toThrow(
        'France Travail API 401',
      );
    });

    it('propage une erreur si l API répond avec un statut 500', async () => {
      mockFetchError(500, 'Internal Server Error');

      await expect(service.listMetiers()).rejects.toThrow(
        'France Travail API 500',
      );
    });

    it('inclut le chemin de l endpoint dans le message d erreur', async () => {
      mockFetchError(503, 'Service Unavailable');

      await expect(service.listMetiers()).rejects.toThrow(
        '/rome-metiers/v1/metiers/metier',
      );
    });

    it('inclut le début du corps de la réponse dans le message d erreur', async () => {
      mockFetchError(400, 'Bad Request details here');

      await expect(service.listMetiers()).rejects.toThrow(
        'Bad Request details here',
      );
    });

    it('propage l erreur réseau si fetch rejette', async () => {
      mockFetchNetworkError('Network failure');

      await expect(service.listMetiers()).rejects.toThrow('Network failure');
    });

    it('propage l erreur si getAccessToken échoue', async () => {
      authMock.getAccessToken.mockRejectedValue(
        new Error('Échec obtention token'),
      );
      vi.stubGlobal('fetch', vi.fn());

      await expect(service.listMetiers()).rejects.toThrow(
        'Échec obtention token',
      );
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  // ─── getMetierDetails ───────────────────────────────────────────────────────

  describe('getMetierDetails', () => {
    it('retourne les détails complets du métier demandé', async () => {
      const details = buildMetierDetails('M1805');
      mockFetchOk(details);

      const result = await service.getMetierDetails('M1805');

      expect(result).toEqual(details);
    });

    it('appelle l endpoint correct pour un code donné', async () => {
      mockFetchOk(buildMetierDetails('M1805'));

      await service.getMetierDetails('M1805');

      expect(fetch).toHaveBeenCalledWith(
        'https://api.francetravail.io/partenaire/rome-metiers/v1/metiers/metier/M1805',
        expect.any(Object),
      );
    });

    it('encode les caractères spéciaux du code dans l URL', async () => {
      mockFetchOk(buildMetierDetails('A/B'));

      await service.getMetierDetails('A/B');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('A%2FB'),
        expect.any(Object),
      );
    });

    it('envoie le token Bearer dans le header Authorization', async () => {
      authMock.getAccessToken.mockResolvedValue('mon-token-secret');
      mockFetchOk(buildMetierDetails());

      await service.getMetierDetails('M1805');

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer mon-token-secret',
          }),
        }),
      );
    });

    it('demande un token via RomeAuthService avant chaque appel', async () => {
      mockFetchOk(buildMetierDetails());

      await service.getMetierDetails('M1805');

      expect(authMock.getAccessToken).toHaveBeenCalledOnce();
    });

    it('propage une erreur si l API répond avec un statut 404', async () => {
      mockFetchError(404, 'Not Found');

      await expect(service.getMetierDetails('INCONNU')).rejects.toThrow(
        'France Travail API 404',
      );
    });

    it('inclut le chemin avec le code dans le message d erreur', async () => {
      mockFetchError(404, 'Not Found');

      await expect(service.getMetierDetails('M9999')).rejects.toThrow(
        '/rome-metiers/v1/metiers/metier/M9999',
      );
    });

    it('propage l erreur réseau si fetch rejette', async () => {
      mockFetchNetworkError('Connection refused');

      await expect(service.getMetierDetails('M1805')).rejects.toThrow(
        'Connection refused',
      );
    });

    it('propage l erreur si getAccessToken échoue', async () => {
      authMock.getAccessToken.mockRejectedValue(
        new Error('Token invalide'),
      );
      vi.stubGlobal('fetch', vi.fn());

      await expect(service.getMetierDetails('M1805')).rejects.toThrow(
        'Token invalide',
      );
      expect(fetch).not.toHaveBeenCalled();
    });

    it('retourne un objet avec des champs optionnels absents si l API les omet', async () => {
      const minimalDetails: RomeMetierDetails = {
        code: 'M1801',
        libelle: 'Architecture SI',
      };
      mockFetchOk(minimalDetails);

      const result = await service.getMetierDetails('M1801');

      expect(result).toEqual(minimalDetails);
      expect(result.definition).toBeUndefined();
      expect(result.competencesMobilisees).toBeUndefined();
    });
  });

  // ─── Construction de l URL (config.apiBaseUrl) ───────────────────────────────

  describe('construction de l URL depuis la configuration', () => {
    it('utilise la base URL issue de la configuration', async () => {
      const customConfig = {
        apiBaseUrl: 'https://mon-api-custom.example.com',
      };
      const customService = new RomeApiService(
        authMock as any,
        customConfig as any,
      );
      mockFetchOk([]);

      await customService.listMetiers();

      expect(fetch).toHaveBeenCalledWith(
        'https://mon-api-custom.example.com/rome-metiers/v1/metiers/metier',
        expect.any(Object),
      );
    });

    it('concatène correctement la base URL et le chemin sans double slash', async () => {
      mockFetchOk([]);

      await service.listMetiers();

      const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(calledUrl).not.toMatch(/\/\//g.source.slice(0, -1) + '(?!$)');
      expect(calledUrl).toBe(
        'https://api.francetravail.io/partenaire/rome-metiers/v1/metiers/metier',
      );
    });
  });

  // ─── Gestion des erreurs HTTP — corps tronqué ────────────────────────────────

  describe('troncature du corps de la réponse en erreur', () => {
    it('tronque le corps d erreur à 200 caractères dans le message', async () => {
      const longBody = 'X'.repeat(500);
      mockFetchError(500, longBody);

      let errorMessage = '';
      try {
        await service.listMetiers();
      } catch (e) {
        errorMessage = (e as Error).message;
      }

      // Le message contient au maximum 200 caractères du corps
      const bodyInMessage = errorMessage.split('Réponse : ')[1] ?? '';
      expect(bodyInMessage.length).toBeLessThanOrEqual(200);
    });

    it('gère proprement un corps de réponse vide en cas d erreur', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 503,
          text: () => Promise.reject(new Error('Impossible de lire le corps')),
        }),
      );

      // Ne doit pas rejeter sur l'erreur de lecture du corps, mais sur l'erreur HTTP
      await expect(service.listMetiers()).rejects.toThrow(
        'France Travail API 503',
      );
    });
  });
});
