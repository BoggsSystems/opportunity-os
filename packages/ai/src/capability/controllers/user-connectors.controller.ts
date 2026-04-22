import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Param, 
  UseGuards,
  Body,
  Query,
  HttpStatus,
  NotFoundException,
  BadRequestException
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CapabilityService } from '../services/capability.service';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthGuard } from '../../auth/guards/auth.guard';

@ApiTags('User Connectors')
@ApiBearerAuth()
@Controller('api/v1/capabilities/connectors')
@UseGuards(AuthGuard)
export class UserConnectorsController {
  constructor(private readonly capabilityService: CapabilityService) {}

  @Get()
  @ApiOperation({ summary: 'Get user connectors' })
  @ApiResponse({ status: 200, description: 'Connectors retrieved successfully' })
  async getUserConnectors(@CurrentUser() user: any) {
    return await this.capabilityService.getUserConnectors(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get specific connector' })
  @ApiResponse({ status: 200, description: 'Connector retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Connector not found' })
  async getConnector(@Param('id') id: string, @CurrentUser() user: any) {
    const connectors = await this.capabilityService.getUserConnectors(user.id);
    const connector = connectors.find(c => c.id === id);
    
    if (!connector) {
      throw new NotFoundException(`Connector '${id}' not found`);
    }
    
    return connector;
  }

  @Post()
  @ApiOperation({ summary: 'Create new connector' })
  @ApiResponse({ status: 201, description: 'Connector created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Capability or provider not found' })
  async createConnector(@Body() createDto: any, @CurrentUser() user: any) {
    try {
      const connector = await this.capabilityService.createConnector(
        user.id,
        createDto.capabilityType,
        createDto.providerName,
        createDto.config
      );

      return {
        success: true,
        data: connector,
        message: 'Connector created successfully'
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update connector' })
  @ApiResponse({ status: 200, description: 'Connector updated successfully' })
  @ApiResponse({ status: 404, description: 'Connector not found' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async updateConnector(
    @Param('id') id: string,
    @Body() updateDto: any,
    @CurrentUser() user: any
  ) {
    try {
      const connector = await this.capabilityService.updateConnector(id, updateDto);
      
      return {
        success: true,
        data: connector,
        message: 'Connector updated successfully'
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete connector' })
  @ApiResponse({ status: 200, description: 'Connector deleted successfully' })
  @ApiResponse({ status: 404, description: 'Connector not found' })
  async deleteConnector(@Param('id') id: string, @CurrentUser() user: any) {
    try {
      await this.capabilityService.deleteConnector(id);
      
      return {
        success: true,
        message: 'Connector deleted successfully'
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Test connector connection' })
  @ApiResponse({ status: 200, description: 'Connection test completed' })
  @ApiResponse({ status: 404, description: 'Connector not found' })
  async testConnector(@Param('id') id: string, @CurrentUser() user: any) {
    try {
      const testResult = await this.capabilityService.testConnector(id);
      
      return {
        success: true,
        data: testResult,
        message: 'Connection test completed'
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      
      return {
        success: false,
        error: error.message,
        message: 'Connection test failed'
      };
    }
  }

  @Post(':id/sync')
  @ApiOperation({ summary: 'Trigger connector sync' })
  @ApiResponse({ status: 200, description: 'Sync triggered successfully' })
  @ApiResponse({ status: 404, description: 'Connector not found' })
  @ApiResponse({ status: 400, description: 'Sync failed' })
  async triggerSync(
    @Param('id') id: string,
    @Body() syncDto: any,
    @CurrentUser() user: any
  ) {
    try {
      const syncResult = await this.capabilityService.syncConnector(id, syncDto);
      
      return {
        success: true,
        data: syncResult,
        message: 'Sync completed successfully'
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      
      return {
        success: false,
        error: error.message,
        message: 'Sync failed'
      };
    }
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Get connector status' })
  @ApiResponse({ status: 200, description: 'Status retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Connector not found' })
  async getConnectorStatus(@Param('id') id: string, @CurrentUser() user: any) {
    const connectors = await this.capabilityService.getUserConnectors(user.id);
    const connector = connectors.find(c => c.id === id);
    
    if (!connector) {
      throw new NotFoundException(`Connector '${id}' not found`);
    }

    return {
      id: connector.id,
      capabilityType: connector.capability?.capabilityType,
      providerName: connector.capabilityProvider?.providerName,
      status: connector.status,
      lastSyncAt: connector.lastSyncAt,
      lastSuccessAt: connector.lastSuccessAt,
      errorMessage: connector.errorMessage,
      syncStatus: connector.connectorSyncStates?.[0]?.syncStatus,
      itemsSynced: connector.connectorSyncStates?.[0]?.itemsSynced
    };
  }
}
