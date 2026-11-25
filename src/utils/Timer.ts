export class Timer {
  private startTime: number;
  private name: string;
  private logFn: (message: string, fields: Record<string, unknown>) => void;
  private hasEnded = false;

  constructor(name: string, logFn: (message: string, fields: Record<string, unknown>) => void) {
    this.name = name;
    this.logFn = logFn;
    this.startTime = Date.now();
  }

  /** Log the duration once, with more fields if you have them. */
  end(fields?: Record<string, unknown>): void {
    if (this.hasEnded) return;
    this.hasEnded = true;
    const durationMs = Date.now() - this.startTime;
    this.logFn(`${this.name} took ${durationMs}ms`, { ...fields, timer: this.name, durationMs });
  }

  /** End the timer at the end of a block: `using timer = log.startTimer("db")`. */
  [Symbol.dispose](): void {
    this.end();
  }
}
