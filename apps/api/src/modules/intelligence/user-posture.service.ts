import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '@opportunity-os/db';
import { AiService } from '../../ai/ai.service';

@Injectable()
export class UserPostureService {
  private readonly logger = new Logger(UserPostureService.name);

  constructor(private readonly aiService: AiService) {}

  async getPosture(userId: string) {
    return prisma.userPosture.findUnique({
      where: { userId }
    });
  }

  /**
   * THE SYNTHESIZER: Regenerates the user's strategic posture from the Vault
   */
  async synthesizePosture(userId: string) {
    this.logger.log(`Synthesizing strategic posture for user ${userId}`);

    // 1. Fetch all promoted concepts and proof points
    const concepts = await prisma.concept.findMany({
      where: { userId, isPromoted: true }
    });

    const proofPoints = await prisma.proofPoint.findMany({
      where: { userId, isPromoted: true }
    });

    if (concepts.length === 0 && proofPoints.length === 0) {
      this.logger.warn(`No intelligence found in vault for user ${userId}. Skipping synthesis.`);
      return null;
    }

    // 2. Pass to AI for persona synthesis
    const vaultSummary = {
      methodologies: concepts.filter(c => c.category === 'methodology' || c.category === 'framework').map(c => c.title),
      stances: concepts.filter(c => c.category === 'stance').map(c => c.title),
      keySuccesses: proofPoints.map(p => p.title)
    };

    const synthesis = await this.aiService.synthesizeStrategicPersona(vaultSummary);

    // 3. Update or create the UserPosture
    return prisma.userPosture.upsert({
      where: { userId },
      update: {
        title: synthesis.title,
        description: synthesis.description,
        postureText: synthesis.postureText,
        toneMetadata: synthesis.toneMetadata,
        objectives: synthesis.objectives
      },
      create: {
        userId,
        title: synthesis.title,
        description: synthesis.description,
        postureText: synthesis.postureText,
        toneMetadata: synthesis.toneMetadata,
        objectives: synthesis.objectives
      }
    });
  }
}
