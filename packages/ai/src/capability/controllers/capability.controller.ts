import { 
  Controller, 
  Get, 
  Post, 
  Param, 
  UseGuards,
  Body,
  Query,
  HttpStatus,
  NotFoundException
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CapabilityService } from '../services/capability.service';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthGuard } from '../../auth/guards/auth.guard';

@ApiTags('Capabilities')
@ApiBearerAuth()
@Controller('api/v1/capabilities')
@UseGuards(AuthGuard)
export class CapabilityController {
  constructor(private readonly capabilityService: CapabilityService) {}

  @Get()
  @ApiOperation({ summary: 'Get all available capabilities' })
  @ApiResponse({ status: 200, description: 'Capabilities retrieved successfully' })
  async getCapabilities() {
    return await this.capabilityService.getCapabilities();
  }

  @Get(':capabilityType')
  @ApiOperation({ summary: 'Get capability by type' })
  @ApiResponse({ status: 200, description: 'Capability retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Capability not found' })
  async getCapability(@Param('capabilityType') capabilityType: string) {
    const capability = await this.capabilityService.getCapability(capabilityType);
    
    if (!capability) {
      throw new NotFoundException(`Capability '${capabilityType}' not found`);
    }
    
    return capability;
  }

  @Get(':capabilityType/providers')
  @ApiOperation({ summary: 'Get providers for a capability type' })
  @ApiResponse({ status: 200, description: 'Providers retrieved successfully' })
  async getProvidersByCapability(@Param('capabilityType') capabilityType: string) {
    return await this.capabilityService.getProvidersByCapability(capabilityType);
  }

  @Get(':capabilityType/providers/:providerName')
  @ApiOperation({ summary: 'Get specific provider details' })
  @ApiResponse({ status: 200, description: 'Provider details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Provider not found' })
  async getProviderDetails(
    @Param('capabilityType') capabilityType: string,
    @Param('providerName') providerName: string
  ) {
    const provider = await this.capabilityService.getProvider(capabilityType, providerName);
    
    if (!provider) {
      throw new NotFoundException(`Provider '${providerName}' not found for capability '${capabilityType}'`);
    }
    
    return {
      providerName: provider.providerName,
      displayName: provider.displayName,
      authType: provider.authType,
      requiredScopes: provider.requiredScopes,
      rateLimits: provider.rateLimits,
      configSchema: provider.configSchema
    };
  }

  @Post(':capabilityType/execute')
  @ApiOperation({ summary: 'Execute a capability operation' })
  @ApiResponse({ status: 200, description: 'Operation executed successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Capability or connector not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async executeCapability(
    @Param('capabilityType') capabilityType: string,
    @Body() executeDto: any,
    @CurrentUser() user: any
  ) {
    try {
      const result = await this.capabilityService.executeCapability(
        user.id,
        capabilityType,
        executeDto.providerName,
        executeDto.operation,
        executeDto.parameters,
        executeDto.context
      );

      return {
        success: true,
        data: result,
        executionId: this.generateExecutionId(),
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  @Get(':capabilityType/schema')
  @ApiOperation({ summary: 'Get capability schema' })
  @ApiResponse({ status: 200, description: 'Schema retrieved successfully' })
  async getCapabilitySchema(@Param('capabilityType') capabilityType: string) {
    const capability = await this.capabilityService.getCapability(capabilityType);
    
    if (!capability) {
      throw new NotFoundException(`Capability '${capabilityType}' not found`);
    }

    // Extract schema from providers
    const providers = await this.capabilityService.getProvidersByCapability(capabilityType);
    const commonFields = this.extractCommonSchemaFields(providers);

    return {
      capabilityType,
      name: capability.name,
      description: capability.description,
      supportedFeatures: capability.supportedFeaturesJson,
      commonFields,
      providers: providers.map(p => ({
        providerName: p.providerName,
        displayName: p.displayName,
        authType: p.authType,
        configSchema: p.configSchema
      }))
    };
  }

  private extractCommonSchemaFields(providers: any[]): any[] {
    // Extract common fields across all providers for this capability type
    const fields = new Set<string>();
    
    providers.forEach(provider => {
      if (provider.configSchema?.properties) {
        Object.keys(provider.configSchema.properties).forEach(field => {
          fields.add(field);
        });
      }
    });

    return Array.from(fields).map(field => ({
      name: field,
      type: 'string', // Simplified - would need proper type extraction
      required: providers.some(p => 
        p.configSchema?.required?.includes(field)
      ),
      description: `Configuration field: ${field}`
    }));
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
