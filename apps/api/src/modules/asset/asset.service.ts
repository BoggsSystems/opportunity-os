import { Injectable, Logger } from '@nestjs/common';
import { prisma, AssetCategory } from '@opportunity-os/db';
import { AiService } from '../ai/ai.service';
import { SystemDateService } from '../../common/system-date.service';
const pdf = require('pdf-parse');

@Injectable()
export class AssetService {
  private readonly logger = new Logger(AssetService.name);

  constructor(
    private aiService: AiService,
    private systemDateService: SystemDateService
  ) {}

  async createAsset(userId: string, data: {
    displayName: string;
    fileName: string;
    fileUrl: string;
    category: AssetCategory;
    mimeType?: string;
  }) {
    this.logger.log(`Creating asset: ${data.displayName} for user: ${userId}`);
    
    return await prisma.userAsset.create({
      data: {
        userId,
        displayName: data.displayName,
        fileName: data.fileName,
        fileUrl: data.fileUrl,
        category: data.category,
        mimeType: data.mimeType,
        createdAt: this.systemDateService.now(),
        updatedAt: this.systemDateService.now(),
      },
    });
  }

  async listAssets(userId: string) {
    return await prisma.userAsset.findMany({
      where: { userId },
      include: { 
        narrative: true,
        rules: true
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getAsset(assetId: string) {
    return await prisma.userAsset.findUnique({
      where: { id: assetId },
      include: { narrative: true, rules: true },
    });
  }

  async analyzeAsset(assetId: string, fileBuffer: Buffer) {
    this.logger.log(`Analyzing asset: ${assetId}`);
    
    let text = '';
    const asset = await this.getAsset(assetId);
    if (!asset) throw new Error('Asset not found');

    try {
      if (asset.mimeType === 'application/pdf' || asset.fileName.endsWith('.pdf')) {
        const data = await pdf(fileBuffer);
        text = data.text;
      } else {
        text = fileBuffer.toString('utf8');
      }
    } catch (error: any) {
      this.logger.error(`Failed to extract text: ${error.message}`);
      text = fileBuffer.toString('utf8').slice(0, 20000);
    }

    const narrativeData = await this.generateStrategicNarrative(text, asset.displayName);

    return await prisma.assetNarrative.upsert({
      where: { assetId },
      update: {
        valueProposition: narrativeData.valueProposition,
        targetPersona: narrativeData.targetPersona,
        keyProofPoints: narrativeData.keyProofPoints,
        aiToneDNA: narrativeData.aiToneDNA,
      },
      create: {
        assetId,
        valueProposition: narrativeData.valueProposition,
        targetPersona: narrativeData.targetPersona,
        keyProofPoints: narrativeData.keyProofPoints,
        aiToneDNA: narrativeData.aiToneDNA,
      },
    });
  }

  private async generateStrategicNarrative(content: string, fileName: string) {
    if (this.systemDateService.isSimulation()) {
      return {
        valueProposition: `Simulated value proposition for ${fileName}`,
        targetPersona: 'Simulated Target Persona',
        keyProofPoints: ['Simulated Proof Point 1', 'Simulated Proof Point 2'],
        aiToneDNA: ['Simulated', 'Professional', 'Efficient'],
      };
    }

    const prompt = `
      Analyze the following professional document and extract a strategic outreach narrative.
      Return the response in JSON format with the following keys:
      - valueProposition: A 1-2 sentence summary of the core value the user offers.
      - targetPersona: The type of person/role this document is most likely to impress.
      - keyProofPoints: A list of 3-5 specific, undeniable achievements or facts from the text.
      - aiToneDNA: A list of 3 adjectives describing the professional tone of the document.

      Document Content:
      ${content.slice(0, 10000)}
    `;

    try {
      const response = await this.aiService.generateText(prompt, { temperature: 0.3 });
      
      // Clean the response in case there is markdown wrapper
      const jsonStr = response.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(jsonStr);
    } catch (error: any) {
      this.logger.error(`Failed to generate narrative: ${error.message}`);
      return {
        valueProposition: 'Professional with demonstrated experience in their field.',
        targetPersona: 'Business Leaders and Hiring Managers',
        keyProofPoints: ['High-value experience detailed in document'],
        aiToneDNA: ['Professional', 'Competent', 'Direct'],
      };
    }
  }

  async deleteAsset(userId: string, assetId: string) {
    // Security check
    const asset = await prisma.userAsset.findUnique({ where: { id: assetId } });
    if (!asset || asset.userId !== userId) throw new Error('Unauthorized');

    return await prisma.userAsset.delete({ where: { id: assetId } });
  }
}
