import { Transport } from "../transports/Transport.js";
import { TransportConfig, LogData } from "../types/index.js";
import { Formatter } from "../core/Formatter.js";

export interface CircuitBreakerOptions {
  threshold?: number;
  timeout?: number;
  resetTimeout?: number;
  onStateChange?: (fromState: string, toState: string) => void;
  onTrip?: (failureCount: number) => void;
  onReset?: () => void;
}

export interface CircuitBreakerStateInfo {
  failureCount: number;
  lastFailureTime: number;
  state: 'closed' | 'half-open' | 'open';
}

export interface CircuitBreakerMetrics {
  totalRequests: number;
  failedRequests: number;
  successfulRequests: number;
  currentState: string;
  averageResponseTime: number;
}

export class CircuitBreakerTransport implements Transport {
  private baseTransport: Transport;
  private state: CircuitBreakerStateInfo;
  private metrics: CircuitBreakerMetrics;
  private options: CircuitBreakerOptions;
  private readonly pending = new Set<Promise<void>>();
  private failure: { error: unknown } | undefined;
  private resetTimer: NodeJS.Timeout | undefined;

  constructor(baseTransport: TransportConfig, options: CircuitBreakerOptions = {}) {
    this.baseTransport = this.createTransport(baseTransport);
    this.options = options;
    this.state = {
      failureCount: 0,
      lastFailureTime: 0,
      state: 'closed'
    };
    this.metrics = {
      totalRequests: 0,
      failedRequests: 0,
      successfulRequests: 0,
      currentState: 'closed',
      averageResponseTime: 0
    };
  }

  private createTransport(config: TransportConfig): Transport {
    if (typeof config === 'function') {
      const TransportClass = config as unknown as new () => Transport;
      return new TransportClass();
    } else if (typeof config === 'object' && config !== null) {
      return config as Transport;
    } else {
      throw new Error('Invalid transport configuration');
    }
  }

  write(data: LogData, formatter: Formatter): void {
    if (!this.canWrite()) {
      throw new Error('Circuit breaker is open');
    }

    this.metrics.totalRequests++;
    const startTime = Date.now();

    const onSuccess = () => {
      this.metrics.successfulRequests++;
      this.resetFailureCount();
      this.updateAverageResponseTime(Date.now() - startTime);
    };

    const onFailure = () => {
      this.metrics.failedRequests++;
      this.recordFailure();
      this.updateAverageResponseTime(Date.now() - startTime);
    };

    if (this.baseTransport.writeAsync) {
      const task = this.baseTransport.writeAsync(data, formatter)
        .then(onSuccess)
        .catch((error: unknown) => {
          this.failure ??= { error };
          onFailure();
        }).finally(() => { this.pending.delete(task); });
      this.pending.add(task);
      return;
    }

    try {
      this.baseTransport.write(data, formatter);
      onSuccess();
    } catch (error) {
      onFailure();
      throw error;
    }
  }

  async writeAsync(data: LogData, formatter: Formatter): Promise<void> {
    if (!this.canWrite()) {
      throw new Error('Circuit breaker is open');
    }

    this.metrics.totalRequests++;
    const startTime = Date.now();
    
    try {
      if (this.baseTransport.writeAsync) {
        await this.baseTransport.writeAsync(data, formatter);
      } else {
        this.baseTransport.write(data, formatter);
      }
      this.metrics.successfulRequests++;
      this.resetFailureCount();
    } catch (error) {
      this.metrics.failedRequests++;
      this.recordFailure();
      throw error;
    }
    
    const duration = Date.now() - startTime;
    this.updateAverageResponseTime(duration);
  }

  // Standard states: 'closed' lets writes through, 'open' rejects them (tripped),
  // and 'half-open' lets a probe through after the timeout.
  private canWrite(): boolean {
    const timeout = this.options.timeout || 60000;
    const sinceLastFailure = Date.now() - this.state.lastFailureTime;

    if (this.state.state === 'open') {
      if (sinceLastFailure < timeout) return false;
      this.setState('half-open');
      return true;
    }

    // Failures older than the timeout no longer count toward the threshold.
    if (this.state.state === 'closed' && this.state.lastFailureTime > 0 && sinceLastFailure >= timeout) {
      this.state.failureCount = 0;
      this.state.lastFailureTime = 0;
    }
    return true;
  }

  private setState(newState: 'open' | 'half-open' | 'closed'): void {
    const oldState = this.state.state;
    if (oldState !== newState) {
      this.state.state = newState;
      this.options.onStateChange?.(oldState, newState);

      if (newState === 'open') {
        this.options.onTrip?.(this.state.failureCount);
      } else if (newState === 'closed') {
        this.options.onReset?.();
      }
    }
  }

  private resetFailureCount(): void {
    if (this.state.state === 'half-open') {
      // The probe succeeded, so the backend recovered.
      this.state.failureCount = 0;
      this.state.lastFailureTime = 0;
      this.setState('closed');
      return;
    }
    if (this.state.failureCount === 0) return;

    this.state.failureCount = Math.max(0, Math.floor(this.state.failureCount * 0.9));
  }

  private updateAverageResponseTime(duration: number): void {
    if (this.metrics.totalRequests > 0) {
      // Use exponential moving average: newAvg = oldAvg * 0.9 + duration * 0.1
      this.metrics.averageResponseTime = 
        this.metrics.averageResponseTime * 0.9 + duration * 0.1;
    }
  }

  private recordFailure(): void {
    this.state.failureCount++;
    this.state.lastFailureTime = Date.now();
    
    // A failed probe trips the breaker again at once.
    if (this.state.state === 'half-open' || this.state.failureCount >= (this.options.threshold || 5)) {
      this.setState('open');

      if (this.options.resetTimeout) {
        if (this.resetTimer) clearTimeout(this.resetTimer);
        this.resetTimer = setTimeout(() => {
          this.reset();
        }, this.options.resetTimeout);
      }
    }
  }

  getMetrics(): CircuitBreakerMetrics {
    return {
      ...this.metrics,
      currentState: this.state.state
    };
  }

  reset(): void {
    this.state = {
      failureCount: 0,
      lastFailureTime: 0,
      state: 'closed'
    };

    this.metrics = {
      totalRequests: 0,
      failedRequests: 0,
      successfulRequests: 0,
      currentState: 'closed',
      averageResponseTime: 0
    };
    
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = undefined;
    }
  }

  async flush(): Promise<void> {
    while (this.pending.size) await Promise.all(this.pending);
    await this.baseTransport.flush?.();
    if (this.failure) {
      const { error } = this.failure;
      this.failure = undefined;
      throw error;
    }
  }

  async close(): Promise<void> {
    try { await this.flush(); } finally {
      this.destroy();
      if (this.baseTransport.close) await this.baseTransport.close();
      else await this.baseTransport.destroy?.();
    }
  }

  destroy(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = undefined;
    }
  }

  isAsyncSupported(): boolean {
    return this.baseTransport.isAsyncSupported?.() || false;
  }
}
