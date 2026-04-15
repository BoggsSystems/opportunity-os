import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { PrismaClient } from '@opportunity-os/db';

const prisma = new PrismaClient();

@Injectable()
export class DevContextInterceptor implements NestInterceptor {
  private devUserId: string | null = null;

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    try {
      // Set dev user context on first request
      if (!this.devUserId) {
        const devUser = await prisma.user.findFirst({
          orderBy: { createdAt: 'desc' },
        });
        this.devUserId = devUser?.id || null;
      }

      // Add dev user to request context
      const request = context.switchToHttp().getRequest();
      request.user = this.devUserId ? { id: this.devUserId } : null;

      return next.handle();
    } catch (error) {
      console.error('DevContextInterceptor error:', error);
      // Continue without user context if there's an error
      const request = context.switchToHttp().getRequest();
      request.user = null;
      return next.handle();
    }
  }
}
