import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { SystemDateService } from './system-date.service';

@Injectable()
export class TimeWarpInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TimeWarpInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const simulatedDateHeader = request.headers['x-nexus-simulated-date'];

    if (simulatedDateHeader) {
      const simulatedDate = new Date(simulatedDateHeader);
      
      if (!isNaN(simulatedDate.getTime())) {
        // Enter the AsyncLocalStorage context for the duration of this request
        return new Observable((observer) => {
          SystemDateService.runWithDate(simulatedDate, () => {
            next.handle().subscribe({
              next: (val) => observer.next(val),
              error: (err) => observer.error(err),
              complete: () => observer.complete(),
            });
          });
        });
      } else {
        this.logger.warn(`Invalid X-Nexus-Simulated-Date header: ${simulatedDateHeader}`);
      }
    }

    return next.handle();
  }
}
