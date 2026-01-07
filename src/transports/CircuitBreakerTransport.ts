import { Transport } from "../transports/Transport.js";
import { TransportConfig, LogData } from "../types/index.js";
import { Formatter } from "../core/Formatter.js";
import { EventEmitter } from "events";

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
  private resetTimer: NodeJS.Timeout | undefined;

  constructor(baseTransport: TransportConfig, options: CircuitBreakerOptions = {}) {
    this.baseTransport = this.createTransport(baseTransport);
    this.options = options;
    this.state = {
      failureCount: 0,
      lastFailureTime: 0,
      state: 'open'
    };
    this.metrics = {
      totalRequests: 0,
      failedRequests: 0,
      successfulRequests: 0,
      currentState: 'open',
      averageResponseTime: 0
    };
  }

  private createTransport(config: TransportConfig): Transport {
    if (typeof config === 'function') {
      const TransportClass = config as unknown as new () => Transport;
      return new TransportClass();
    } else if (typeof config === 'object' && config !== null) {
      const TransportClass = config.constructor as new () => Transport;
      return new TransportClass();
    } else {
      throw new Error('Invalid transport configuration');
    }
  }

  write(data: LogData, formatter: Formatter): void {
    if (!this.canWrite()) {
      throw new Error('Circuit breaker is open');
    }

    this.metrics.totalRequests++;
    
    try {
      this.baseTransport.write(data, formatter);
      this.metrics.successfulRequests++;
      this.resetFailureCount();
    } catch (error) {
      this.metrics.failedRequests++;
      this.recordFailure();
      throw error;
    }
    
    this.updateAverageResponseTime();
  }

  async writeAsync(data: LogData, formatter: Formatter): Promise<void> {
    if (!this.canWrite()) {
      throw new Error('Circuit breaker is open');
    }

    this.metrics.totalRequests++;
    
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
    
    this.updateAverageResponseTime();
  }

  private canWrite(): boolean {
    const threshold = this.options.threshold || 5;
    const timeout = this.options.timeout || 60000;
    
    if (this.state.state === 'closed') {
      const timeSinceOpen = Date.now() - this.state.lastFailureTime;
      if (timeSinceOpen >= timeout) {
        this.setState('open');
        return true;
      }
      return false;
    }
    
    if (this.state.failureCount >= threshold) {
      this.setState('closed');
      return false;
    }
    
    if (this.state.state === 'half-open' && this.state.lastFailureTime > 0 && Date.now() - this.state.lastFailureTime < timeout) {
      this.setState('open');
      return true;
    }
    
    return this.state.state === 'open' || this.state.state === 'half-open';
  }

  private setState(newState: 'open' | 'half-open' | 'closed'): void {
    const oldState = this.state.state;
    if (oldState !== newState) {
      this.state.state = newState;
      this.options.onStateChange?.(oldState, newState);
      
      if (newState === 'closed') {
        this.options.onTrip?.(this.state.failureCount);
      } else if (newState === 'open' && oldState === 'closed') {
        this.options.onReset?.();
      }
    }
  }

  private resetFailureCount(): void {
    if (this.state.failureCount === 0) return;
    
    this.state.failureCount = Math.max(1, Math.floor(this.state.failureCount * 0.9));
  }

  private updateAverageResponseTime(): void {
    if (this.metrics.totalRequests > 0) {
      this.metrics.averageResponseTime = 
        this.metrics.averageResponseTime * 0.9 + 
        (Date.now() - (this.metrics.averageResponseTime || 0)) / this.metrics.totalRequests;
    }
  }

  private recordFailure(): void {
    this.state.failureCount++;
    this.state.lastFailureTime = Date.now();
    
    if (this.state.failureCount === 1) {
      this.state.state = 'half-open';
    }
    
    if (this.state.failureCount >= (this.options.threshold || 5)) {
      this.setState('closed');
      
      if (this.options.resetTimeout) {
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
      state: 'open'
    };
    
    this.metrics = {
      totalRequests: 0,
      failedRequests: 0,
      successfulRequests: 0,
      currentState: 'open',
      averageResponseTime: 0
    };
    
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = undefined;
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