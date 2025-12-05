export class Timer {
  private startTime: number;
  private name: string;
  private logFn: (message: string) => void;
  private hasEnded: boolean = false;

  constructor(name: string, logFn: (message: string) => void) {
    this.name = name;
    this.logFn = logFn;
    this.startTime = Date.now();
  }

  end(): void {
    // If already ended, do nothing (idempotent)
    if (this.hasEnded) {
      return;
    }

    const endTime = Date.now();
    const duration = endTime - this.startTime;
    this.logFn(`${this.name} took ${duration}ms`);
    this.hasEnded = true;
  }
}
