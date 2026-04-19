import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);
  private readonly openAiApiKey: string;

  constructor(private configService: ConfigService) {
    this.openAiApiKey = this.configService.get<string>('OPENAI_API_KEY');
  }

  async generateSpeech(text: string, voice: string = 'alloy'): Promise<Buffer> {
    if (!this.openAiApiKey) {
      throw new Error('OpenAI API key not configured for TTS');
    }

    this.logger.log(`Generating speech for text length: ${text.length} using voice: ${voice}`);

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: voice,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`OpenAI TTS API error: ${response.status} - ${errorText}`);
      throw new Error(`OpenAI TTS API error: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    this.logger.log(`Generated audio buffer: ${buffer.length} bytes`);
    return buffer;
  }
}
