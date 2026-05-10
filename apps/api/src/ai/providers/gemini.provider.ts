import { GoogleGenAI } from '@google/genai';
import type { AiCompletionOptions, AiProvider } from './ai-provider.interface';

export class GeminiProvider implements AiProvider {
  readonly name = 'gemini';
  private readonly client: GoogleGenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async complete(options: AiCompletionOptions): Promise<string> {
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: options.prompt,
      config: {
        temperature: options.temperature ?? 0.1,
        ...(options.maxOutputTokens
          ? { maxOutputTokens: options.maxOutputTokens }
          : {}),
      },
    });
    return (response.text ?? '').trim();
  }
}
