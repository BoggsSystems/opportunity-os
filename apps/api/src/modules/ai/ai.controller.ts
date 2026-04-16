import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('test')
  async testConnection() {
    try {
      const result = await this.aiService.generateText('Hello! This is a test of the AI integration. Please respond with a simple confirmation.');
      return {
        success: true,
        message: 'AI provider is working',
        response: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'AI provider test failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('summarize')
  async summarizeText(@Body() body: { text: string }) {
    if (!body.text) {
      throw new HttpException(
        { message: 'Text is required for summarization' },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const summary = await this.aiService.summarizeText(body.text);
      return {
        success: true,
        originalText: body.text,
        summary,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Summarization failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('interpret-offering')
  async interpretOffering(@Body() body: { offeringContext: any }) {
    if (!body.offeringContext) {
      throw new HttpException(
        { message: 'Offering context is required' },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const interpretation = await this.aiService.interpretOffering(body.offeringContext);
      return {
        success: true,
        interpretation,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Offering interpretation failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
