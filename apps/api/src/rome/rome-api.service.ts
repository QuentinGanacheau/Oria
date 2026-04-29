import { Injectable, Logger } from '@nestjs/common';
import { RomeAuthService } from './rome-auth.service';
import { RomeConfig } from './rome.config';
import type { RomeMetierDetails, RomeMetierListItem } from './rome.types';

/**
 * Client HTTP pour l'API ROME 4.0 de France Travail.
 *
 * Responsabilités :
 *  - Construire les URLs en respectant la base configurée
 *  - Ajouter le header Authorization avec le token courant
 *  - Parser la réponse JSON et propager les erreurs HTTP
 *
 * Volontairement minimal : pas de logique de retry ni de transformation —
 * c'est le rôle du `RomeSyncService`.
 */
@Injectable()
export class RomeApiService {
  private readonly logger = new Logger(RomeApiService.name);

  constructor(
    private readonly auth: RomeAuthService,
    private readonly config: RomeConfig,
  ) {}

  /**
   * Liste tous les métiers ROME (codes + libellés).
   * Endpoint : GET /rome-metiers/v1/metiers/metier
   */
  async listMetiers(): Promise<RomeMetierListItem[]> {
    return this.get<RomeMetierListItem[]>('/rome-metiers/v1/metiers/metier');
  }

  /**
   * Détail complet d'un métier (compétences, contextes…).
   * Endpoint : GET /rome-metiers/v1/metiers/metier/{code}
   */
  async getMetierDetails(code: string): Promise<RomeMetierDetails> {
    return this.get<RomeMetierDetails>(
      `/rome-metiers/v1/metiers/metier/${encodeURIComponent(code)}`,
    );
  }

  /** Helper interne — ajoute auth + parse + log d'erreur uniforme. */
  private async get<T>(path: string): Promise<T> {
    const token = await this.auth.getAccessToken();
    const url = `${this.config.apiBaseUrl}${path}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `France Travail API ${response.status} sur ${path}. Réponse : ${body.slice(0, 200)}`,
      );
    }

    return response.json() as Promise<T>;
  }
}
