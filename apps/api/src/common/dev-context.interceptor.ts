import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { prisma } from '@opportunity-os/db';
import { getConfig } from '@opportunity-os/config';

@Injectable()
export class DevContextInterceptor implements NestInterceptor {
  private devUserId: string | null = null;
  private readonly config = getConfig();

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    try {
      const request = context.switchToHttp().getRequest();

      if (request.user || this.config.NODE_ENV === 'production') {
        return next.handle();
      }

      // Set dev user context on first request
      if (!this.devUserId) {
        const devUser = await prisma.user.findFirst({
          orderBy: { createdAt: 'desc' },
        });
        this.devUserId = devUser?.id || null;
      }

      // Add dev user to request context
      request.user = this.devUserId ? { id: this.devUserId } : null;

      return next.handle();
    } catch (error) {
      console.error('DevContextInterceptor error:', error);
      // Continue without user context if there's an error
      const request = context.switchToHttp().getRequest();
      if (!request.user) {
        request.user = null;
      }
      return next.handle();
    }
  }
}
