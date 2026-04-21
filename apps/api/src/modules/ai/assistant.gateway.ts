import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server } from 'ws';
import { Logger } from '@nestjs/common';
import { AiService } from './ai.service';
import { TtsService } from './tts.service';

@WebSocketGateway({ path: '/assistant' })
export class AssistantGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(AssistantGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly aiService: AiService,
    private readonly ttsService: TtsService,
  ) {}

  handleConnection(_client: any) {
    this.logger.log(`WS Client connected`);
  }

  handleDisconnect(_client: any) {
    this.logger.log(`WS Client disconnected`);
  }

  @SubscribeMessage('converse')
  async handleConverse(
    @ConnectedSocket() client: any,
    @MessageBody() data: any
  ) {
    this.logger.log(`🚀 WS HANDLING CONVERSE: ${JSON.stringify(data).substring(0, 200)}`);
    await this.processConverse(client, data);
  }

  private async processConverse(client: any, data: any) {
    const { sessionId, guestSessionId, message, history, context, userId } = data;

    this.logger.log(`🎤 WS ASSISTANT: converse request message="${message}"`);

    try {
      // 1. Start the AI Stream
      const sessionResponse = await this.aiService.startStreamConversation({
        userId,
        sessionId,
        guestSessionId,
        message,
        history,
        context,
      });

      const activeSessionId = sessionResponse.sessionId;
      client.send(JSON.stringify({ type: 'session_started', sessionId: activeSessionId }));

      let fullReply = '';
      let sentenceBuffer = '';
      let isFirstChunk = true;
      let detectedAction: string | undefined;

      // 2. Process chunks
      for await (const chunk of sessionResponse.stream) {
        // Handle tool calls in real-time
        if (chunk.startsWith('{"_tool_calls":')) {
           try {
             const parsed = JSON.parse(chunk);
             for (const call of parsed._tool_calls) {
               if (call.function?.name === 'propose_goal') {
                 detectedAction = 'PROPOSE_GOAL';
                 client.send(JSON.stringify({ type: 'text_chunk', text: "Excellent. I'm drafting that goal proposal for you now..." }));
                 client.send(JSON.stringify({ type: 'ui_event', event: 'PROPOSE_GOAL_SIGNAL' }));
               } else if (call.function?.name === 'propose_campaign') {
                 detectedAction = 'PROPOSE_CAMPAIGN';
                 client.send(JSON.stringify({ type: 'text_chunk', text: "I'm preparing the strategic campaign details for your review..." }));
                 client.send(JSON.stringify({ type: 'ui_event', event: 'PROPOSE_CAMPAIGN_SIGNAL' }));
               }
             }
           } catch (e) {}
           continue;
        }

        fullReply += chunk;
        sentenceBuffer += chunk;

        // Emit text chunk
        client.send(JSON.stringify({ type: 'text_chunk', text: chunk }));

        // Sentence boundary detection for TTS
        if (/[.!?]\s/.test(sentenceBuffer) || (chunk.match(/[.!?]$/) && !isFirstChunk)) {
          const sentenceToSpeak = sentenceBuffer.trim();
          sentenceBuffer = '';
          
          this.ttsService.generateSpeech(sentenceToSpeak).then(audioBuffer => {
            // Binary Send for raw audio speed
            client.send(audioBuffer, { binary: true });
          }).catch(err => {
            this.logger.error('TTS Failed', err);
          });
        }
        isFirstChunk = false;
      }

      // 3. Finalize
      if (sentenceBuffer.trim()) {
        const audioBuffer = await this.ttsService.generateSpeech(sentenceBuffer.trim());
        client.send(audioBuffer, { binary: true });
      }

      const result = await this.aiService.finalizeStreamConversation(userId, guestSessionId, activeSessionId, message, fullReply, history, detectedAction);
      
      // 4. Send the "Done" packet with the strategic plan
      const finalPayload = JSON.stringify({
        type: 'converse_done',
        reply: fullReply,
        suggestedAction: result?.suggestedAction,
        strategicPlan: result?.strategicPlan
      });
      
      this.logger.log(`📦 SENDING FINAL PAYLOAD to client: ${finalPayload.substring(0, 500)}...`);
      client.send(finalPayload);

    } catch (error: any) {
      this.logger.error(`WS Conversation failed: ${error.message}`);
      client.send(JSON.stringify({ type: 'error', message: error.message }));
    }
  }
}
