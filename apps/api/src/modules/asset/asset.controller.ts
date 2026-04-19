import { 
  Controller, 
  Post, 
  Get, 
  Delete, 
  Param, 
  Body, 
  UploadedFile, 
  UseInterceptors, 
  UseGuards, 
  Req,
  HttpException,
  HttpStatus,
  Logger
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AssetService } from './asset.service';
import { AuthGuard } from '../auth/auth.guard';
import { AssetCategory } from '@opportunity-os/db';

@Controller('assets')
@UseGuards(AuthGuard)
export class AssetController {
  private readonly logger = new Logger(AssetController.name);

  constructor(private readonly assetService: AssetService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAsset(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { displayName?: string; category?: AssetCategory }
  ) {
    const userId = req.user?.id;
    if (!userId) throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    if (!file) throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);

    this.logger.log(`Receiving asset upload: ${file.originalname} for user: ${userId}`);

    try {
      // 1. Create the asset record
      // NOTE: In production, we would upload to Supabase Storage here and get the public URL.
      // For this implementation, we store the metadata and process the buffer immediately.
      const asset = await this.assetService.createAsset(userId, {
        displayName: body.displayName || file.originalname,
        fileName: file.originalname,
        fileUrl: `internal://assets/${userId}/${Date.now()}_${file.originalname}`,
        category: body.category || AssetCategory.other,
        mimeType: file.mimetype,
      });

      // 2. Trigger strategic analysis (Interview the asset)
      await this.assetService.analyzeAsset(asset.id, file.buffer);

      const finalAsset = await this.assetService.getAsset(asset.id);
      
      this.logger.log(`Asset successfully processed and analyzed: ${asset.id}`);
      
      return {
        success: true,
        asset: finalAsset,
      };
    } catch (error: any) {
      this.logger.error(`Asset upload failed: ${error.message}`);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to process asset',
          error: error.message
        }, 
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get()
  async listAssets(@Req() req: any) {
    const userId = req.user?.id;
    if (!userId) throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    
    const assets = await this.assetService.listAssets(userId);
    return {
      success: true,
      assets,
    };
  }

  @Get(':id')
  async getAsset(@Req() req: any, @Param('id') id: string) {
    const userId = req.user?.id;
    const asset = await this.assetService.getAsset(id);
    
    if (!asset || asset.userId !== userId) {
      throw new HttpException('Asset not found', HttpStatus.NOT_FOUND);
    }
    
    return {
      success: true,
      asset,
    };
  }

  @Delete(':id')
  async deleteAsset(@Req() req: any, @Param('id') id: string) {
    const userId = req.user?.id;
    if (!userId) throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);

    try {
      await this.assetService.deleteAsset(userId, id);
      return { 
        success: true,
        message: 'Asset deleted successfully'
      };
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to delete asset',
          error: error.message
        },
        HttpStatus.FORBIDDEN
      );
    }
  }
}
