import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiGet, apiPost } from './api';

// ─── Helper ───────────────────────────────────────────────────────────────────

function mockFetch(status: number, body: unknown) {
  return vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      json: vi.fn().mockResolvedValue(body),
      text: vi.fn().mockResolvedValue(String(body)),
    }),
  );
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('api', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── apiGet ────────────────────────────────────────────────────────────────

  describe('apiGet', () => {
    it('appelle fetch avec la bonne URL et retourne le JSON parse', async () => {
      const payload = { stripeEnabled: false };
      mockFetch(200, payload);

      const result = await apiGet<typeof payload>('/v1/billing/status');

      expect(fetch).toHaveBeenCalledWith('http://localhost:4000/v1/billing/status');
      expect(result).toEqual(payload);
    });

    it('leve une erreur si la reponse nest pas OK', async () => {
      mockFetch(500, 'Internal Server Error');

      await expect(apiGet('/v1/jobs')).rejects.toThrow();
    });
  });

  // ── apiPost ───────────────────────────────────────────────────────────────

  describe('apiPost', () => {
    it('appelle fetch en POST avec les bons headers et le body JSON', async () => {
      const payload = { url: 'https://checkout.stripe.com/session' };
      mockFetch(200, payload);

      const body = { successPath: '/resultats', cancelPath: '/resultats' };
      const result = await apiPost<typeof payload>(
        '/v1/billing/checkout/full-report',
        body,
      );

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:4000/v1/billing/checkout/full-report',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
      );
      expect(result).toEqual(payload);
    });

    it('leve une erreur si la reponse nest pas OK', async () => {
      mockFetch(400, 'Bad Request');

      await expect(apiPost('/v1/billing/checkout/full-report', {})).rejects.toThrow();
    });
  });
});
