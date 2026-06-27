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

  /**
   * Compte les offres d'emploi actives pour un code ROME via l'API
   * « Offres d'emploi v2 ». On demande la plage minimale (`range=0-0`) car
   * seul le total nous intéresse : il est renvoyé dans l'en-tête
   * `Content-Range` au format `offres 0-0/<total>`.
   *
   * Renvoie `null` (et non une exception) si l'appel échoue ou si l'API n'est
   * pas accessible : l'indicateur de recrutement est une donnée d'agrément, son
   * absence ne doit jamais faire échouer la sync du métier (dégradation propre).
   *
   * Cas particuliers :
   *  - 204 No Content → 0 offre (l'API ne renvoie pas d'en-tête dans ce cas).
   *  - en-tête absent / illisible → null (on ne sait pas, on ne devine pas).
   */
  async countOffersByRome(code: string): Promise<number | null> {
    try {
      const token = await this.auth.getAccessToken();
      const url = `${this.config.apiBaseUrl}${this.config.offresSearchPath}?codeROME=${encodeURIComponent(code)}&range=0-0`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      // 204 = aucune offre pour ce code ROME.
      if (response.status === 204) return 0;

      if (!response.ok && response.status !== 206) {
        this.logger.warn(
          `Comptage offres ${code} : statut ${response.status} inattendu.`,
        );
        return null;
      }

      // Format attendu : "offres 0-0/1234" → on extrait le nombre après "/".
      const contentRange = response.headers.get('content-range');
      const total = contentRange?.split('/').pop();
      const parsed = total ? Number.parseInt(total, 10) : NaN;
      return Number.isFinite(parsed) ? parsed : null;
    } catch (error) {
      this.logger.warn(
        `Comptage offres ${code} indisponible : ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
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
