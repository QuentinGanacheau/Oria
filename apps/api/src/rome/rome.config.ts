import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Configuration centralisée pour l'intégration France Travail / ROME 4.0.
 *
 * Lazy validation : on ne valide les credentials qu'au moment où ils sont
 * réellement utilisés (récupération du token), pas à l'instanciation du module.
 * Cela permet à l'API web de démarrer normalement même si les variables ROME
 * ne sont pas configurées (utile en dev local).
 */
@Injectable()
export class RomeConfig {
  constructor(private readonly config: ConfigService) {}

  get clientId(): string {
    return this.config.getOrThrow<string>('FRANCE_TRAVAIL_CLIENT_ID');
  }

  get clientSecret(): string {
    return this.config.getOrThrow<string>('FRANCE_TRAVAIL_CLIENT_SECRET');
  }

  /** URL d'obtention du token OAuth. Surchargeable pour tests / environnements. */
  get tokenUrl(): string {
    return (
      this.config.get<string>('FRANCE_TRAVAIL_TOKEN_URL') ??
      'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire'
    );
  }

  /** Base URL des appels API. La version v1 de ROME-Métiers est ajoutée par le service. */
  get apiBaseUrl(): string {
    return (
      this.config.get<string>('FRANCE_TRAVAIL_API_URL') ??
      'https://api.francetravail.io/partenaire'
    );
  }

  /**
   * Scope OAuth requis pour ROME-Métiers v1.
   * Vérifie le scope exact dans ton tableau de bord francetravail.io
   * — il peut être différent selon les API auxquelles tu es abonné.
   */
  get scope(): string {
    return (
      this.config.get<string>('FRANCE_TRAVAIL_SCOPE') ??
      'api_rome-metiersv1 nomenclatureRome'
    );
  }
}
