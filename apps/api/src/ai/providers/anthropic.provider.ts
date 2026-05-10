import Anthropic from '@anthropic-ai/sdk';
import type { AiCompletionOptions, AiProvider } from './ai-provider.interface';

export class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic';
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async complete(options: AiCompletionOptions): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: options.maxOutputTokens ?? 1024,
      temperature: options.temperature ?? 0.1,
      messages: [{ role: 'user', content: options.prompt }],
    });

    // L'API retourne un tableau de blocs (texte, outils, etc.) — on agrège le texte uniquement.
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    return text.trim();
  }
}
