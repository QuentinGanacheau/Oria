import { Injectable, Logger } from '@nestjs/common';
import { RomeConfig } from './rome.config';

type CachedToken = {
  value: string;
  /** Timestamp Unix (ms) auquel le token expire effectivement. */
  expiresAt: number;
};

/** Marge de sécurité avant expiration : on renouvelle 1 minute avant. */
const RENEW_THRESHOLD_MS = 60_000;

/**
 * Gère l'obtention et la mise en cache du token OAuth 2.0 client_credentials
 * pour l'API France Travail.
 *
 * Le token est valable ~1499 secondes (~25 min) selon la doc France Travail.
 * On le réutilise tant qu'il n'est pas (presque) expiré pour économiser les
 * appels au serveur d'auth — particulièrement utile lors d'une sync de 530
 * métiers qui prend plusieurs minutes.
 */
@Injectable()
export class RomeAuthService {
  private readonly logger = new Logger(RomeAuthService.name);
  private cached: CachedToken | null = null;

  constructor(private readonly config: RomeConfig) {}

  /**
   * Retourne un token valide. Réutilise le cache si possible, sinon renouvelle.
   * @throws Error si l'authentification échoue (credentials invalides, réseau, scope).
   */
  async getAccessToken(): Promise<string> {
    if (this.cached && this.cached.expiresAt > Date.now() + RENEW_THRESHOLD_MS) {
      return this.cached.value;
    }
    return this.fetchNewToken();
  }

  private async fetchNewToken(): Promise<string> {
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      scope: this.config.scope,
    });

    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Échec d'obtention du token OAuth (${response.status}). Réponse : ${body}`,
      );
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };

    this.cached = {
      value: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    this.logger.log(
      `Token OAuth obtenu (valide ${data.expires_in}s).`,
    );
    return data.access_token;
  }
}
