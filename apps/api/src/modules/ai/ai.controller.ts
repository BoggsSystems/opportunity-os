import { Controller, Post, Body, HttpException, HttpStatus, Res, Logger, Req } from '@nestjs/common';
import { Response } from 'express';
import { AiService } from './ai.service';
import { TtsService } from './tts.service';
import { prisma } from '@opportunity-os/db';
import { CommercialService } from '../commercial/commercial.service';
import { Public } from '../auth/public.decorator';

@Controller('ai')
export class AiController {
  private readonly logger = new Logger(AiController.name);

  constructor(
    private readonly aiService: AiService,
    private readonly ttsService: TtsService,
    private readonly commercialService: CommercialService,
  ) {}

  
  @Post('test')
  async testConnection(@Req() req: any) {
    try {
      const aiAllowance = await this.consumeAiRequest(req.user?.id);
      if (aiAllowance) {
        return aiAllowance;
      }

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
  async summarizeText(@Body() body: { text: string }, @Req() req: any) {
    if (!body.text) {
      throw new HttpException(
        { message: 'Text is required for summarization' },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const aiAllowance = await this.consumeAiRequest(req.user?.id);
      if (aiAllowance) {
        return aiAllowance;
      }

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
  async interpretOffering(@Body() body: { offeringContext: any }, @Req() req: any) {
    if (!body.offeringContext) {
      throw new HttpException(
        { message: 'Offering context is required' },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const aiAllowance = await this.consumeAiRequest(req.user?.id);
      if (aiAllowance) {
        return aiAllowance;
      }

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

  @Public()
  @Post('converse')
  async converse(@Body() body: {
    sessionId?: string;
    guestSessionId?: string;
    message?: string;
    history?: Array<{ role: 'system' | 'user' | 'assistant'; text: string }>;
    context?: Record<string, unknown>;
  }, @Req() req: any) {
    const userId = req.user?.id;
    const isOnboarding = body.context?.['currentStep'] !== undefined;
    
    this.logger.log(`🎤 CONVERSE DEBUG: userId=${userId ?? 'GUEST'} isOnboarding=${isOnboarding} req.user=${JSON.stringify(req.user ?? 'NONE')}`);

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
      // Exempt onboarding from strict allowance checks to ensure smooth UX
      if (!isOnboarding) {
        const aiAllowance = await this.consumeAiRequest(userId);
        if (aiAllowance) {
          this.logger.warn(`🎤 CONVERSE DEBUG: Allowance BLOCKED for userId=${userId}`);
          return aiAllowance;
        }
      } else {
        this.logger.log(`🎤 CONVERSE DEBUG: Onboarding turn - bypassing allowance check`);
      }

      const strategicContext = isOnboarding 
        ? { phase: 'STRATEGY', mission: `Onboarding: ${body.context?.['currentStep']}. Maintain narration, avoid goal-verification loops.` }
        : body.context?.['strategicContext'];

      this.logger.log(
        `🎤 CONVERSE DEBUG: Calling aiService.converse for sessionId=${body.sessionId ?? 'GUEST'}`,
      );
      const reply = await this.aiService.converse({
        userId,
        userName,
        sessionId: body.sessionId || body.guestSessionId || 'default',
        guestSessionId: body.guestSessionId,
        message: body.message,
        history: body.history,
        context: {
          ...body.context,
          workspaceState: (isOnboarding ? 'ONBOARDING' : body.context?.['workspaceState']) as string
        },
        strategicContext: strategicContext as any,
      });
      this.logger.log(
        `🎤 VOICE PIPELINE: converse response sessionId=${reply.sessionId} reply="${reply.reply.slice(0, 200)}..."`,
      );

      return {
        success: true,
        sessionId: reply.sessionId,
        reply: reply.reply,
        shouldBeSilent: reply.shouldBeSilent,
        suggestedAction: reply.suggestedAction,
        onboardingPlan: (reply as any).onboardingPlan,
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
      guestSessionId?: string;
      message?: string;
      history?: Array<{ role: 'system' | 'user' | 'assistant'; text: string }>;
      context?: Record<string, unknown>;
    },
    @Req() req: any,
    @Res() res: Response,
  ) {
    const userId = req.user?.id;

    if (!body.message?.trim()) {
      throw new HttpException(
        { message: 'Message is required for conversational turns' },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      if (userId) {
        const aiAllowance = await this.commercialService.incrementUsage(userId, 'ai_requests');
        if (!aiAllowance.allowed) {
          res.status(HttpStatus.PAYMENT_REQUIRED).json({
            success: false,
            blocked: true,
            ...aiAllowance,
          });
          return;
        }
      }

      this.logger.log(
        `🎤 VOICE PIPELINE: converse-stream request userId=${userId ?? 'GUEST'} sessionId=${body.sessionId ?? 'new'} message="${body.message}"`,
      );

      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');

      // 1. Setup the session and start the stream
      const sessionResponse = await this.aiService.startStreamConversation({
        userId,
        sessionId: body.sessionId,
        guestSessionId: body.guestSessionId,
        message: body.message,
        history: body.history,
        context: body.context as any,
      });

      const activeSessionId = sessionResponse.sessionId;
      res.write(`${JSON.stringify({ type: 'session', sessionId: activeSessionId })}\n`);

      // 2. Consume the stream
      let fullReply = '';
      let sentenceBuffer = '';
      let isFirstChunk = true;

      let toolCallsDetected = 0;
      let chunksReceived = 0;

      for await (const chunk of sessionResponse.stream) {
        chunksReceived++;
        
        if (chunk.startsWith('{"_tool_calls":')) {
          toolCallsDetected++;
          this.logger.log(`[ConverseStream] TOOL CALL chunk detected #${toolCallsDetected}: ${chunk.substring(0, 100)}`);
          try {
            const parsed = JSON.parse(chunk);
            for (const call of parsed._tool_calls) {
              this.logger.log(`[ConverseStream] Processing tool call: ${call.function?.name}`);
              if (call.function?.name === 'propose_goal') {
                this.logger.log(`[ConverseStream] → Sending PROPOSE_GOAL action to frontend`);
                res.write(`${JSON.stringify({ type: 'action', sessionId: activeSessionId, action: 'PROPOSE_GOAL' })}\n`);
              }
            }
          } catch (e) {
            this.logger.warn(`[ConverseStream] Failed to parse tool call chunk: ${chunk.substring(0, 100)}`);
          }
          continue;
        }

        fullReply += chunk;
        sentenceBuffer += chunk;
        res.write(`${JSON.stringify({ type: 'chunk', sessionId: activeSessionId, text: chunk })}\n`);

        // Basic sentence boundary detection
        if (/[.!?]\s/.test(sentenceBuffer) || (chunk.match(/[.!?]$/) && !isFirstChunk)) {
          const sentenceToSpeak = sentenceBuffer.trim();
          sentenceBuffer = ''; // Reset buffer immediately so text stream continues

          // Fire and forget TTS generation
          this.ttsService.generateSpeech(sentenceToSpeak).then(audioBuffer => {
            const base64Audio = audioBuffer.toString('base64');
            res.write(`${JSON.stringify({ type: 'audio_chunk', sessionId: activeSessionId, audio: base64Audio })}\n`);
          }).catch(err => {
            this.logger.error('Failed to generate audio chunk', err);
          });
        }
        isFirstChunk = false;
      }

      // 3. Handle trailing sentence for TTS
      if (sentenceBuffer.trim().length > 0) {
        const sentenceToSpeak = sentenceBuffer.trim();
        this.ttsService.generateSpeech(sentenceToSpeak).then(audioBuffer => {
          const base64Audio = audioBuffer.toString('base64');
          res.write(`${JSON.stringify({ type: 'audio_chunk', sessionId: activeSessionId, audio: base64Audio })}\n`);
        }).catch(err => {
          this.logger.error('Failed to generate final audio chunk', err);
        });
      }

      // 5. Finalize and Persist
      this.logger.log(`[ConverseStream] Stream ended. Total chunks: ${chunksReceived}, toolCalls: ${toolCallsDetected}`);
      this.logger.log(`[ConverseStream] Finalizing conversation for sessionId=${activeSessionId}`);
      this.logger.log(`[ConverseStream] Full reply length: ${fullReply.length} chars, first 100: "${fullReply.substring(0, 100)}..."`);
      
      const result = await this.aiService.finalizeStreamConversation(userId, body.guestSessionId, activeSessionId, body.message, fullReply, body.history).catch(err => {
        this.logger.error(`[ConverseStream] Failed to persist stream conversation sessionId=${activeSessionId}: ${err.message}`);
        return { suggestedAction: undefined, strategicPlan: undefined };
      });

      this.logger.log(`[ConverseStream] Finalize result: action=${result?.suggestedAction || 'NONE'}, hasPlan=${result?.strategicPlan ? 'YES' : 'NO'}`);

      res.write(`${JSON.stringify({ 
        type: 'done', 
        sessionId: activeSessionId, 
        reply: fullReply, 
        shouldBeSilent: false,
        suggestedAction: result?.suggestedAction,
        onboardingPlan: result?.strategicPlan
      })}\n`);
      this.logger.log(`[ConverseStream] Sent 'done' message to frontend with action=${result?.suggestedAction || 'NONE'}`);
      res.end();
    } catch (err: any) {
      this.logger.error(`Conversation stream failed: ${err.message}`, err.stack);
      res.write(`${JSON.stringify({ type: 'error', message: err.message })}\n`);
      res.end();
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

  /**
   * Finalizes onboarding by extracting goal from conversation and persisting to database.
   * Called when user completes the goal discovery conversation.
  */
  @Post('preview-strategic-plan')
  async previewStrategicPlan(@Body() body: { sessionId: string; guestSessionId?: string }, @Req() req: any) {
    try {
      const aiAllowance = await this.consumeAiRequest(req.user?.id);
      if (aiAllowance) {
        return aiAllowance;
      }

      return await this.aiService.previewStrategicPlan(body.sessionId, body.guestSessionId);
    } catch (err: any) {
      this.logger.error(`Preview failed: ${err.message}`);
      throw new HttpException({ success: false, error: err.message }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Public()
  @Post('finalize-strategic-goal')
  async finalizeStrategicGoal(
    @Body() body: { sessionId: string; guestSessionId?: string },
    @Req() req: any,
  ) {
    const userId = req.user?.id;
    // We allow guests to finalize goals to establish intent before signup
    
    if (!body.sessionId?.trim()) {
      throw new HttpException(
        { message: 'sessionId is required' },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const aiAllowance = await this.consumeAiRequest(userId);
      if (aiAllowance) {
        return aiAllowance;
      }

      this.logger.log(
        `🎯 STRATEGY: Finalizing for userId=${userId ?? 'GUEST'}, sessionId=${body.sessionId}`
      );

      const result = await this.aiService.finalizeStrategicGoal(userId, body.sessionId, body.guestSessionId || body.sessionId);

      this.logger.log(
        `🎯 STRATEGY: Completed - Goal "${result.goal.title}" created with campaign "${result.campaign.title}"`
      );

      return {
        success: true,
        goal: result.goal,
        campaign: result.campaign,
        extractedIntent: result.extractedIntent,
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      this.logger.error(`Strategy finalization failed: ${err.message}`, err.stack);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to finalize strategic goal',
          error: err instanceof Error ? err.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Receives debug logs from the frontend and prints them to the server console.
   */
  @Post('debug-logs')
  async receiveDebugLogs(@Body() body: { message: string; level?: string }) {
    const level = body.level || 'INFO';
    this.logger.log(`📱 FRONTEND_DEBUG [${level}]: ${body.message}`);
    return { success: true };
  }

  private async consumeAiRequest(userId?: string) {
    if (!userId) {
      return null;
    }

    const allowance = await this.commercialService.incrementUsage(userId, 'ai_requests');
    if (allowance.allowed) {
      return null;
    }

    return {
      success: false,
      blocked: true,
      ...allowance,
    };
  }
}
