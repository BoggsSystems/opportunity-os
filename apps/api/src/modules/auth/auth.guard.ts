import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getConfig } from '@opportunity-os/config';
import { AuthService } from './auth.service';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly config = getConfig();
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const url = request.url;
    const method = request.method;
    
    this.logger.log(`🔐 AUTH GUARD: ${method} ${url}`);

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      this.logger.log(`🔐 AUTH GUARD: Public endpoint, allowing access`);
      return true;
    }

    const authHeader = request.headers.authorization as string | undefined;
    this.logger.log(`🔐 AUTH GUARD: Auth header present: ${!!authHeader}`);
    
    if (authHeader) {
      this.logger.log(`🔐 AUTH GUARD: Auth header length: ${authHeader.length}`);
      this.logger.log(`🔐 AUTH GUARD: Auth header prefix: ${authHeader.substring(0, 30)}...`);
    }

    if (!authHeader) {
      this.logger.log(`🔐 AUTH GUARD: No auth header, NODE_ENV: ${this.config.NODE_ENV}`);
      if (this.config.NODE_ENV !== 'production') {
        this.logger.log(`🔐 AUTH GUARD: Development mode - bypassing authentication`);
        // Inject a mock user for development
        request.user = {
          id: 'b7d60c45-0cd6-45db-bdc8-6fd4b1dc084d',
          sub: 'b7d60c45-0cd6-45db-bdc8-6fd4b1dc084d',
          email: 'demo@opportunity-os.com'
        };
        return true;
      }
      this.logger.error(`🔐 AUTH GUARD: Missing authorization header in production`);
      throw new UnauthorizedException('Missing authorization header');
    }

    const [scheme, token] = authHeader.split(' ');
    this.logger.log(`🔐 AUTH GUARD: Scheme: "${scheme}", Token length: ${token?.length || 0}`);
    
    if (scheme !== 'Bearer' || !token) {
      this.logger.error(`🔐 AUTH GUARD: Invalid auth header format`);
      throw new UnauthorizedException('Invalid authorization header');
    }

    try {
      this.logger.log(`🔐 AUTH GUARD: Validating access token...`);
      request.user = await this.authService.validateAccessToken(token);
      this.logger.log(`🔐 AUTH GUARD: Token validation successful, user: ${request.user?.sub || request.user?.id}`);
      return true;
    } catch (error) {
      this.logger.error(`🔐 AUTH GUARD: Token validation failed:`, error);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
