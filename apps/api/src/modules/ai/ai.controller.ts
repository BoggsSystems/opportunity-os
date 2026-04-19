import { Controller, Post, Body, HttpException, HttpStatus, Res, Logger, Req } from '@nestjs/common';
import { Response } from 'express';
import { AiService } from './ai.service';
import { TtsService } from './tts.service';
import { prisma } from '@opportunity-os/db';

@Controller('ai')
export class AiController {
  private readonly logger = new Logger(AiController.name);

  constructor(
    private readonly aiService: AiService,
    private readonly ttsService: TtsService
  ) {}

  
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
  }, @Req() req: any) {
    const userId = req.user?.id;
    
    let userName: string | undefined = undefined;
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { fullName: true }
      });
      userName = user?.fullName || undefined;
    }

    if (!body.message?.trim()) {
      throw new HttpException(
        { message: 'Message is required for conversational turns' },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      this.logger.log(
        `🎤 VOICE PIPELINE: converse request userId=${userId ?? 'GUEST'} userName=${userName ?? 'unknown'} sessionId=${body.sessionId ?? 'new'} message="${body.message}"`,
      );
      const reply = await this.aiService.converse({
        userId,
        userName,
        sessionId: body.sessionId,
        message: body.message,
        history: body.history,
        context: body.context as any,
      });
      this.logger.log(
        `🎤 VOICE PIPELINE: converse response sessionId=${reply.sessionId} reply="${reply.reply.slice(0, 200)}..."`,
      );

      return {
        success: true,
        sessionId: reply.sessionId,
        reply: reply.reply,
        shouldBeSilent: reply.shouldBeSilent,
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      this.logger.error(`Conversation turn failed: ${err.message}`, err.stack);
      throw new HttpException(
        {
          success: false,
          message: 'Conversation turn failed',
          error: err instanceof Error ? err.message : 'Unknown error',
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
    @Req() req: any,
    @Res() res: Response,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new HttpException({ message: 'Unauthorized' }, HttpStatus.UNAUTHORIZED);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true }
    });

    if (!body.message?.trim()) {
      throw new HttpException(
        { message: 'Message is required for conversational turns' },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      this.logger.log(
        `🎤 VOICE PIPELINE: converse-stream request userId=${userId} userName=${user?.fullName ?? 'unknown'} sessionId=${body.sessionId ?? 'new'} message="${body.message}"`,
      );
      const reply = await this.aiService.converse({
        userId,
        userName: user?.fullName || undefined,
        sessionId: body.sessionId,
        message: body.message,
        history: body.history,
        context: body.context,
      });

      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');

      res.write(`${JSON.stringify({ type: 'session', sessionId: reply.sessionId })}\n`);
      this.logger.log(`🎤 VOICE PIPELINE: converse-stream session established sessionId=${reply.sessionId}`);

      for (const chunk of this.aiService.streamReplyChunks(reply.reply)) {
        this.logger.log(`🎤 VOICE PIPELINE: converse-stream chunk sessionId=${reply.sessionId} text="${chunk.slice(0, 200)}..."`);
        res.write(`${JSON.stringify({ type: 'chunk', sessionId: reply.sessionId, text: chunk })}\n`);
        await new Promise((resolve) => setTimeout(resolve, 55));
      }

      this.logger.log(
        `🎤 VOICE PIPELINE: converse-stream done sessionId=${reply.sessionId} reply="${reply.reply.slice(0, 200)}..." shouldBeSilent=${reply.shouldBeSilent}`
      );
      res.write(
        `${JSON.stringify({ type: 'done', sessionId: reply.sessionId, reply: reply.reply, shouldBeSilent: reply.shouldBeSilent })}\n`,
      );
      res.end();
    } catch (err: any) {
      this.logger.error(`Conversation stream failed: ${err.message}`, err.stack);
      throw new HttpException(
        {
          success: false,
          message: 'Conversation stream failed',
          error: err instanceof Error ? err.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('tts')
  async generateSpeech(
    @Body() body: { text: string; voice?: string },
    @Res() res: Response
  ) {
    if (!body.text?.trim()) {
      throw new HttpException(
        { message: 'Text is required for TTS' },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      this.logger.log(`🎤 VOICE PIPELINE: TTS request text="${body.text.slice(0, 100)}..." voice=${body.voice ?? 'alloy'}`);
      const audioBuffer = await this.ttsService.generateSpeech(body.text, body.voice);
      
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length,
      });

      res.send(audioBuffer);
    } catch (err: any) {
      this.logger.error(`TTS generation failed: ${err.message}`, err.stack);
      throw new HttpException(
        {
          success: false,
          message: 'TTS generation failed',
          error: err instanceof Error ? err.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
