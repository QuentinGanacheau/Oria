import OpenAI from 'openai';
import type { AiCompletionOptions, AiProvider } from './ai-provider.interface';

/**
 * Provider Mistral 🇪🇺.
 *
 * L'API Mistral est compatible OpenAI : on réutilise donc le SDK `openai`
 * (déjà présent) en pointant simplement le `baseURL` sur leur endpoint.
 *
 * Nuance vs OpenAiProvider : Mistral n'expose PAS l'API « Responses »
 * (`client.responses.create`). On passe donc par `chat.completions`, que
 * Mistral supporte pleinement.
 */
export class MistralProvider implements AiProvider {
  readonly name = 'mistral';
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.client = new OpenAI({ apiKey, baseURL: 'https://api.mistral.ai/v1' });
  }

  async complete(options: AiCompletionOptions): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: options.temperature ?? 0.1,
      max_tokens: options.maxOutputTokens,
      messages: [{ role: 'user', content: options.prompt }],
    });

    return (response.choices[0]?.message?.content ?? '').trim();
  }
}
