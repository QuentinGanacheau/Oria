/**
 * Contrat commun à tous les providers d'IA.
 *
 * Un provider ne sait faire qu'une seule chose : recevoir un prompt texte
 * et retourner une complétion texte. Toute la logique métier (construction
 * du prompt, parsing JSON, validation, fallback) vit dans l'AiService.
 *
 * Bénéfices :
 * - Découplage total du code métier vis-à-vis du SDK utilisé.
 * - Ajout d'un nouveau provider = 1 fichier, 0 modification du reste.
 * - Tests plus faciles : on peut mocker cette interface sans toucher au SDK.
 */
export interface AiCompletionOptions {
  prompt: string;
  /** Entre 0 (déterministe) et 1 (créatif). Défaut côté provider si absent. */
  temperature?: number;
  /** Limite de tokens en sortie ; les providers ont des défauts raisonnables. */
  maxOutputTokens?: number;
}

export interface AiProvider {
  /** Identifiant lisible, utilisé uniquement pour les logs. */
  readonly name: string;

  /**
   * Envoie un prompt et retourne la réponse texte brute (déjà trim).
   * Peut lever : c'est à l'appelant d'attraper et décider du fallback.
   */
  complete(options: AiCompletionOptions): Promise<string>;
}
