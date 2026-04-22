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

@ApiTags('Capability Execution')
@ApiBearerAuth()
@Controller('api/v1/capabilities/execute')
@UseGuards(AuthGuard)
export class CapabilityExecutionController {
  constructor(private readonly capabilityService: CapabilityService) {}

  @Post(':capabilityType')
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

  @Post(':capabilityType/batch')
  @ApiOperation({ summary: 'Execute batch capability operations' })
  @ApiResponse({ status: 200, description: 'Batch operations executed successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async executeBatch(
    @Param('capabilityType') capabilityType: string,
    @Body() batchDto: any,
    @CurrentUser() user: any
  ) {
    const results = [];
    const errors = [];

    for (const operation of batchDto.operations) {
      try {
        const result = await this.capabilityService.executeCapability(
          user.id,
          capabilityType,
          operation.providerName,
          operation.operation,
          operation.parameters,
          operation.context
        );

        results.push({
          success: true,
          data: result,
          operationId: operation.id
        });
      } catch (error) {
        errors.push({
          operationId: operation.id,
          error: error.message
        });
      }
    }

    return {
      success: errors.length === 0,
      data: {
        results,
        errors
      },
      summary: {
        total: batchDto.operations.length,
        successful: results.length,
        failed: errors.length
      }
    };
  }

  @Get(':executionId/status')
  @ApiOperation({ summary: 'Get execution status' })
  @ApiResponse({ status: 200, description: 'Execution status retrieved' })
  @ApiResponse({ status: 404, description: 'Execution not found' })
  async getExecutionStatus(@Param('executionId') executionId: string, @CurrentUser() user: any) {
    // In a real implementation, this would query the execution logs
    // For now, return a mock status
    
    return {
      executionId,
      status: 'completed',
      startTime: new Date(Date.now() - 5000), // 5 seconds ago
      endTime: new Date(),
      duration: 5000,
      result: 'Operation completed successfully'
    };
  }

  @Get(':executionId/result')
  @ApiOperation({ summary: 'Get execution result' })
  @ApiResponse({ status: 200, description: 'Execution result retrieved' })
  @ApiResponse({ status: 404, description: 'Execution not found' })
  async getExecutionResult(@Param('executionId') executionId: string, @CurrentUser() user: any) {
    // In a real implementation, this would fetch the actual execution result
    // For now, return a mock result
    
    return {
      executionId,
      success: true,
      data: {
        messageId: 'msg_123456',
        threadId: 'thread_789',
        status: 'sent',
        timestamp: new Date()
      },
      metadata: {
        provider: 'gmail',
        operation: 'send',
        duration: 1250
      }
    };
  }

  @Post(':executionId/cancel')
  @ApiOperation({ summary: 'Cancel execution' })
  @ApiResponse({ status: 200, description: 'Execution cancelled' })
  @ApiResponse({ status: 404, description: 'Execution not found' })
  async cancelExecution(@Param('executionId') executionId: string, @CurrentUser() user: any) {
    // In a real implementation, this would:
    // 1. Check if execution is cancellable
    // 2. Update execution status to 'cancelled'
    // 3. Notify any running processes
    
    return {
      success: true,
      message: 'Execution cancelled successfully',
      executionId
    };
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
