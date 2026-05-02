import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RomeAuthService } from './rome-auth.service';
import type { RomeConfig } from './rome.config';

// ─── Constantes ──────────────────────────────────────────────────────────────

const TOKEN_VALUE = 'access-token-abc123';
const EXPIRES_IN = 1499; // ~25 min, valeur France Travail standard

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Crée un mock RomeConfig avec des valeurs par défaut surchageables. */
function buildConfig(overrides: Partial<RomeConfig> = {}): RomeConfig {
  return {
    clientId: 'client-id-test',
    clientSecret: 'client-secret-test',
    tokenUrl: 'https://auth.example.com/token',
    scope: 'api_rome-metiersv1 nomenclatureRome',
    apiBaseUrl: 'https://api.example.com',
    ...overrides,
  } as RomeConfig;
}

/** Crée un mock fetch qui retourne une réponse OAuth réussie. */
function mockFetchSuccess(
  accessToken = TOKEN_VALUE,
  expiresIn = EXPIRES_IN,
): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue({
      access_token: accessToken,
      expires_in: expiresIn,
    }),
    text: vi.fn().mockResolvedValue(''),
  });
}

/** Crée un mock fetch qui retourne une erreur HTTP. */
function mockFetchError(status: number, body: string): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    text: vi.fn().mockResolvedValue(body),
    json: vi.fn(),
  });
}

/** Crée un mock fetch qui rejette (erreur réseau). */
function mockFetchNetworkError(message = 'Network error'): ReturnType<typeof vi.fn> {
  return vi.fn().mockRejectedValue(new Error(message));
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('RomeAuthService', () => {
  let service: RomeAuthService;
  let config: RomeConfig;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    config = buildConfig();
    service = new RomeAuthService(config);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Obtention initiale du token ─────────────────────────────────────────

  describe('obtention initiale du token', () => {
    it('appelle l endpoint tokenUrl avec la méthode POST', async () => {
      fetchSpy = mockFetchSuccess();
      vi.stubGlobal('fetch', fetchSpy);

      await service.getAccessToken();

      expect(fetchSpy).toHaveBeenCalledWith(
        config.tokenUrl,
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('envoie le Content-Type application/x-www-form-urlencoded', async () => {
      fetchSpy = mockFetchSuccess();
      vi.stubGlobal('fetch', fetchSpy);

      await service.getAccessToken();

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );
    });

    it('inclut client_id, client_secret, grant_type et scope dans le body', async () => {
      fetchSpy = mockFetchSuccess();
      vi.stubGlobal('fetch', fetchSpy);

      await service.getAccessToken();

      const callArgs = fetchSpy.mock.calls[0][1] as RequestInit;
      const body = callArgs.body as string;
      const params = new URLSearchParams(body);

      expect(params.get('grant_type')).toBe('client_credentials');
      expect(params.get('client_id')).toBe(config.clientId);
      expect(params.get('client_secret')).toBe(config.clientSecret);
      expect(params.get('scope')).toBe(config.scope);
    });

    it('retourne l access_token reçu dans la réponse', async () => {
      fetchSpy = mockFetchSuccess('mon-token-frais');
      vi.stubGlobal('fetch', fetchSpy);

      const token = await service.getAccessToken();

      expect(token).toBe('mon-token-frais');
    });
  });

  // ─── Mise en cache du token ───────────────────────────────────────────────

  describe('mise en cache du token', () => {
    it('ne fait qu un seul appel fetch pour deux appels consécutifs', async () => {
      fetchSpy = mockFetchSuccess();
      vi.stubGlobal('fetch', fetchSpy);

      await service.getAccessToken();
      await service.getAccessToken();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('retourne le même token depuis le cache au deuxième appel', async () => {
      fetchSpy = mockFetchSuccess(TOKEN_VALUE);
      vi.stubGlobal('fetch', fetchSpy);

      const first = await service.getAccessToken();
      const second = await service.getAccessToken();

      expect(first).toBe(TOKEN_VALUE);
      expect(second).toBe(TOKEN_VALUE);
    });

    it('conserve le token en cache tant qu il reste plus d une minute de validité', async () => {
      const now = Date.now();
      vi.useFakeTimers();
      vi.setSystemTime(now);

      fetchSpy = mockFetchSuccess(TOKEN_VALUE, EXPIRES_IN);
      vi.stubGlobal('fetch', fetchSpy);

      await service.getAccessToken();

      // Avance de 23 minutes (< 25 min - 1 min de marge)
      vi.advanceTimersByTime(23 * 60 * 1000);

      await service.getAccessToken();

      expect(fetchSpy).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });

  // ─── Renouvellement du token à expiration ────────────────────────────────

  describe('renouvellement du token à expiration', () => {
    it('renouvelle le token quand il reste moins d une minute de validité', async () => {
      const now = Date.now();
      vi.useFakeTimers();
      vi.setSystemTime(now);

      fetchSpy = mockFetchSuccess(TOKEN_VALUE, EXPIRES_IN);
      vi.stubGlobal('fetch', fetchSpy);

      await service.getAccessToken();

      // Avance jusqu'à la fenêtre de renouvellement : expires_in - 60s + 1ms
      vi.advanceTimersByTime((EXPIRES_IN - 60) * 1000 + 1);

      const newToken = 'nouveau-token-renouvelé';
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          access_token: newToken,
          expires_in: EXPIRES_IN,
        }),
        text: vi.fn().mockResolvedValue(''),
      });

      const token = await service.getAccessToken();

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(token).toBe(newToken);

      vi.useRealTimers();
    });

    it('renouvelle le token quand le cache est expiré', async () => {
      const now = Date.now();
      vi.useFakeTimers();
      vi.setSystemTime(now);

      fetchSpy = mockFetchSuccess(TOKEN_VALUE, EXPIRES_IN);
      vi.stubGlobal('fetch', fetchSpy);

      await service.getAccessToken();

      // Avance bien au-delà de l'expiration
      vi.advanceTimersByTime(EXPIRES_IN * 1000 + 5000);

      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          access_token: 'token-post-expiration',
          expires_in: EXPIRES_IN,
        }),
        text: vi.fn().mockResolvedValue(''),
      });

      const token = await service.getAccessToken();

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(token).toBe('token-post-expiration');

      vi.useRealTimers();
    });

    it('met à jour le cache avec le nouveau token après renouvellement', async () => {
      const now = Date.now();
      vi.useFakeTimers();
      vi.setSystemTime(now);

      fetchSpy = mockFetchSuccess(TOKEN_VALUE, EXPIRES_IN);
      vi.stubGlobal('fetch', fetchSpy);

      await service.getAccessToken();
      vi.advanceTimersByTime(EXPIRES_IN * 1000 + 1000);

      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          access_token: 'token-renouvelé',
          expires_in: EXPIRES_IN,
        }),
        text: vi.fn().mockResolvedValue(''),
      });

      await service.getAccessToken();

      // Troisième appel : doit encore utiliser le cache (le nouveau)
      const third = await service.getAccessToken();

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(third).toBe('token-renouvelé');

      vi.useRealTimers();
    });
  });

  // ─── Erreurs d'authentification ──────────────────────────────────────────

  describe('credentials invalides', () => {
    it('lève une erreur si le serveur répond 401', async () => {
      fetchSpy = mockFetchError(401, 'invalid_client');
      vi.stubGlobal('fetch', fetchSpy);

      await expect(service.getAccessToken()).rejects.toThrow(
        /Échec d'obtention du token OAuth \(401\)/,
      );
    });

    it('lève une erreur si le serveur répond 400', async () => {
      fetchSpy = mockFetchError(400, 'invalid_scope');
      vi.stubGlobal('fetch', fetchSpy);

      await expect(service.getAccessToken()).rejects.toThrow(
        /Échec d'obtention du token OAuth \(400\)/,
      );
    });

    it('inclut le corps de la réponse dans le message d erreur', async () => {
      fetchSpy = mockFetchError(401, 'Credentials invalides détaillés');
      vi.stubGlobal('fetch', fetchSpy);

      await expect(service.getAccessToken()).rejects.toThrow(
        /Credentials invalides détaillés/,
      );
    });

    it('lève une erreur pour tout statut HTTP non-ok (ex: 500)', async () => {
      fetchSpy = mockFetchError(500, 'Internal Server Error');
      vi.stubGlobal('fetch', fetchSpy);

      await expect(service.getAccessToken()).rejects.toThrow(
        /Échec d'obtention du token OAuth \(500\)/,
      );
    });
  });

  // ─── Erreurs réseau ──────────────────────────────────────────────────────

  describe('erreur réseau', () => {
    it('propage l erreur si fetch rejette (timeout, DNS, etc.)', async () => {
      fetchSpy = mockFetchNetworkError('fetch failed');
      vi.stubGlobal('fetch', fetchSpy);

      await expect(service.getAccessToken()).rejects.toThrow('fetch failed');
    });

    it('ne met pas en cache un token si une erreur réseau survient', async () => {
      fetchSpy = mockFetchNetworkError('Network error');
      vi.stubGlobal('fetch', fetchSpy);

      await expect(service.getAccessToken()).rejects.toThrow();

      // Deuxième appel : fetch doit être rappelé (pas de cache pollué)
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          access_token: TOKEN_VALUE,
          expires_in: EXPIRES_IN,
        }),
        text: vi.fn().mockResolvedValue(''),
      });

      const token = await service.getAccessToken();

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(token).toBe(TOKEN_VALUE);
    });

    it('ne met pas en cache un token si l authentification échoue (HTTP 401)', async () => {
      fetchSpy = mockFetchError(401, 'invalid_client');
      vi.stubGlobal('fetch', fetchSpy);

      await expect(service.getAccessToken()).rejects.toThrow();

      // Deuxième appel avec credentials valides : doit refaire un fetch
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          access_token: TOKEN_VALUE,
          expires_in: EXPIRES_IN,
        }),
        text: vi.fn().mockResolvedValue(''),
      });

      const token = await service.getAccessToken();

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(token).toBe(TOKEN_VALUE);
    });
  });
});
