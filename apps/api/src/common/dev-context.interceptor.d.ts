import { NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
export declare class DevContextInterceptor implements NestInterceptor {
    private devUserId;
    intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>>;
}
//# sourceMappingURL=dev-context.interceptor.d.ts.map