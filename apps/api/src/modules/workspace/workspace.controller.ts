import { Body, Controller, Get, Post, UnauthorizedException } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { WorkspaceCommandDto } from './dto/workspace-command.dto';
import { WorkspaceService } from './workspace.service';

@Controller('workspace')
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Get()
  async getWorkspace(@CurrentUser() user?: AuthenticatedUser) {
    if (!user?.id) {
      throw new UnauthorizedException('No authenticated user found');
    }
    return this.workspaceService.getWorkspaceState(user.id);
  }

  @Post('commands')
  async executeCommand(
    @Body() command: WorkspaceCommandDto,
    @CurrentUser() user?: any,
  ) {
    console.log('📨 [WORKSPACE_CONTROLLER] Received command:', JSON.stringify(command, null, 2));
    if (!user?.id) {
      throw new UnauthorizedException('No authenticated user found');
    }
    return this.workspaceService.executeCommand(user.id, command);
  }
}
