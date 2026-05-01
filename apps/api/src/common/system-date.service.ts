import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

@Injectable()
export class SystemDateService {
  private static readonly als = new AsyncLocalStorage<Date>();

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
   * Helper to get the start of the current (warped) day.
   */
  today(): Date {
    const d = this.now();
    d.setHours(0, 0, 0, 0);
    return d;
  }
}
