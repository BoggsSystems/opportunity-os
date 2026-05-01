import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

@Injectable()
export class SystemDateService {
  private static readonly als = new AsyncLocalStorage<Date>();

  /**
   * Returns true if we are currently running in a 'Time Warp' simulation context.
   */
  isSimulation(): boolean {
    return SystemDateService.als.getStore() !== undefined;
  }

  /**
   * Returns the current date. If a 'Time Warp' date is set for the current 
   * request context, it returns that instead of the real system time.
   */
  now(): Date {
    const warpedDate = SystemDateService.als.getStore();
    return warpedDate ? new Date(warpedDate) : new Date();
  }

  /**
   * Executes a function within a specific 'Time Warp' context.
   */
  static runWithDate<T>(date: Date, fn: () => T): T {
    return this.als.run(date, fn);
  }

  /**
   * Helper to get the start of the current (warped) day in UTC.
   */
  today(): Date {
    const d = this.now();
    return new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
    );
  }
}
