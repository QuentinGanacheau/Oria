import OpenAI from 'openai';
import type { AiCompletionOptions, AiProvider } from './ai-provider.interface';

export class OpenAiProvider implements AiProvider {
  readonly name = 'openai';
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.client = new OpenAI({ apiKey });
  }

  async complete(options: AiCompletionOptions): Promise<string> {
    const response = await this.client.responses.create({
      model: this.model,
      input: options.prompt,
      temperature: options.temperature ?? 0.1,
    });
    return (response.output_text ?? '').trim();
  }
}
