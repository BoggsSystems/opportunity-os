import { Controller, Post, Body, HttpException, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
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

  @Post('converse')
  async converse(@Body() body: {
    sessionId?: string;
    message?: string;
    history?: Array<{ role: 'system' | 'user' | 'assistant'; text: string }>;
    context?: Record<string, unknown>;
  }) {
    if (!body.message?.trim()) {
      throw new HttpException(
        { message: 'Message is required for conversational turns' },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const reply = await this.aiService.converse({
        sessionId: body.sessionId,
        message: body.message,
        history: body.history,
        context: body.context,
      });

      return {
        success: true,
        sessionId: reply.sessionId,
        reply: reply.reply,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Conversation turn failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('converse-stream')
  async converseStream(
    @Body() body: {
      sessionId?: string;
      message?: string;
      history?: Array<{ role: 'system' | 'user' | 'assistant'; text: string }>;
      context?: Record<string, unknown>;
    },
    @Res() res: Response,
  ) {
    if (!body.message?.trim()) {
      throw new HttpException(
        { message: 'Message is required for conversational turns' },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const reply = await this.aiService.converse({
        sessionId: body.sessionId,
        message: body.message,
        history: body.history,
        context: body.context,
      });

      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');

      res.write(`${JSON.stringify({ type: 'session', sessionId: reply.sessionId })}\n`);

      for (const chunk of this.aiService.streamReplyChunks(reply.reply)) {
        res.write(`${JSON.stringify({ type: 'chunk', sessionId: reply.sessionId, text: chunk })}\n`);
        await new Promise((resolve) => setTimeout(resolve, 55));
      }

      res.write(
        `${JSON.stringify({ type: 'done', sessionId: reply.sessionId, reply: reply.reply })}\n`,
      );
      res.end();
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Conversation stream failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
