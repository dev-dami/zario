import { Transport } from "./Transport.js";
import { LogData } from "../types/index.js";
import { Formatter } from "../core/Formatter.js";
import { EventEmitter } from "events";

export interface RetryTransportOptions {
  wrappedTransport: Transport;
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  jitter?: boolean;
  retryableErrorCodes?: string[];
  retryableErrorPatterns?: RegExp[];
  circuitBreakerThreshold?: number;
  circuitBreakerTimeout?: number;
  onRetryAttempt?: (attempt: number, error: Error, delay: number) => void;
  onRetryExhausted?: (lastError: Error, attempts: number) => void;
  onCircuitBreakerOpen?: () => void;
  onCircuitBreakerClose?: () => void;
}

export interface RetryContext {
  attempt: number;
  totalAttempts: number;
  originalError: Error;
  delay: number;
  startTime: number;
}

export enum CircuitBreakerState {
  CLOSED = "closed",
  OPEN = "open", 
  HALF_OPEN = "half_open"
}

export class RetryTransport extends EventEmitter implements Transport {
  private wrappedTransport: Transport;
  private maxAttempts: number;
  private baseDelay: number;
  private maxDelay: number;
  private backoffMultiplier: number;
  private jitter: boolean;
  private retryableErrorCodes: Set<string>;
  private retryableErrorPatterns: RegExp[];
  
  private circuitBreakerThreshold: number;
  private circuitBreakerTimeout: number;
  private circuitBreakerState: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount: number = 0;
  private circuitBreakerOpenTime: number = 0;

  private onRetryAttempt: ((attempt: number, error: Error, delay: number) => void) | undefined;
  private onRetryExhausted: ((lastError: Error, attempts: number) => void) | undefined;
  private onCircuitBreakerOpen: (() => void) | undefined;
  private onCircuitBreakerClose: (() => void) | undefined;

  constructor(options: RetryTransportOptions) {
    super();
    
    const {
      wrappedTransport,
      maxAttempts = 3,
      baseDelay = 1000,
      maxDelay = 30000,
      backoffMultiplier = 2,
      jitter = true,
      retryableErrorCodes = [
        'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND',
        'EAI_AGAIN', 'EHOSTUNREACH', 'ENETUNREACH', 'ENOENT',
        'EMFILE', 'ENFILE'
      ],
      retryableErrorPatterns = [
        /timeout/i,
        /network/i,
        /connection/i,
        /temporary/i,
        /rate limit/i,
        /too many requests/i,
        /service unavailable/i,
        /bad gateway/i
      ],
      circuitBreakerThreshold = 5,
      circuitBreakerTimeout = 60000,
      onRetryAttempt,
      onRetryExhausted,
      onCircuitBreakerOpen,
      onCircuitBreakerClose
    } = options;

    if (!wrappedTransport) {
      throw new Error('RetryTransport requires a wrappedTransport');
    }

    this.wrappedTransport = wrappedTransport;
    this.maxAttempts = maxAttempts;
    this.baseDelay = baseDelay;
    this.maxDelay = maxDelay;
    this.backoffMultiplier = backoffMultiplier;
    this.jitter = jitter;
    this.retryableErrorCodes = new Set(retryableErrorCodes);
    this.retryableErrorPatterns = retryableErrorPatterns;
    this.circuitBreakerThreshold = circuitBreakerThreshold;
    this.circuitBreakerTimeout = circuitBreakerTimeout;
    this.onRetryAttempt = onRetryAttempt;
    this.onRetryExhausted = onRetryExhausted;
    this.onCircuitBreakerOpen = onCircuitBreakerOpen;
    this.onCircuitBreakerClose = onCircuitBreakerClose;
  }

  write(data: LogData, formatter: Formatter): void {
    setImmediate(async () => {
      try {
        await this.writeWithRetry(data, formatter);
      } catch (error) {
        this.emit('error', { type: 'retry_transport_exhausted', error });
      }
    });
  }

  async writeAsync(data: LogData, formatter: Formatter): Promise<void> {
    return this.writeWithRetry(data, formatter);
  }

  private async writeWithRetry(data: LogData, formatter: Formatter): Promise<void> {
    if (this.isCircuitBreakerOpen()) {
      throw new Error('Circuit breaker is open - rejecting requests');
    }

    let lastError: Error | null = null;
    const startTime = Date.now();

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        if (this.wrappedTransport.writeAsync) {
          await this.wrappedTransport.writeAsync(data, formatter);
        } else {
          await new Promise<void>((resolve, reject) => {
            try {
              this.wrappedTransport.write(data, formatter);
              resolve();
            } catch (error) {
              reject(error);
            }
          });
        }

        this.resetFailureCount();
        this.maybeCloseCircuitBreaker();
        return;

      } catch (error) {
        lastError = error as Error;
        
        if (!this.isRetryableError(lastError) || attempt === this.maxAttempts) {
          break;
        }

        const delay = this.calculateDelay(attempt);
        const retryContext: RetryContext = {
          attempt,
          totalAttempts: this.maxAttempts,
          originalError: lastError,
          delay,
          startTime
        };

        this.emit('retryAttempt', retryContext);
        this.onRetryAttempt?.(attempt, lastError, delay);

        await this.delay(delay);
      }
    }

    this.incrementFailureCount();
    this.maybeOpenCircuitBreaker();

    const errorContext = {
      lastError,
      attempts: this.maxAttempts,
      totalTime: Date.now() - startTime,
      data: {
        level: data.level,
        message: data.message,
        timestamp: data.timestamp
      }
    };

    this.emit('retryExhausted', errorContext);
    this.onRetryExhausted?.(lastError!, this.maxAttempts);

    throw lastError;
  }

  private isRetryableError(error: Error): boolean {
    const errorCode = (error as any).code;
    const errorMessage = error.message;

    if (errorCode && this.retryableErrorCodes.has(errorCode)) {
      return true;
    }

    for (const pattern of this.retryableErrorPatterns) {
      if (pattern.test(errorMessage)) {
        return true;
      }
    }

    return false;
  }

  private calculateDelay(attempt: number): number {
    let delay = this.baseDelay * Math.pow(this.backoffMultiplier, attempt - 1);

    delay = Math.min(delay, this.maxDelay);

    if (this.jitter) {
      const jitterAmount = delay * 0.25;
      const jitter = (Math.random() * 2 - 1) * jitterAmount;
      delay += jitter;
    }

    return Math.max(0, Math.floor(delay));
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private isCircuitBreakerOpen(): boolean {
    if (this.circuitBreakerState === CircuitBreakerState.OPEN) {
      if (Date.now() - this.circuitBreakerOpenTime >= this.circuitBreakerTimeout) {
        this.circuitBreakerState = CircuitBreakerState.HALF_OPEN;
        this.emit('circuitBreakerHalfOpen');
        return false;
      }
      return true;
    }
    return false;
  }

  private incrementFailureCount(): void {
    this.failureCount++;
    this.maybeOpenCircuitBreaker();
  }

  private resetFailureCount(): void {
    this.failureCount = 0;
  }

  private maybeOpenCircuitBreaker(): void {
    if (this.circuitBreakerState === CircuitBreakerState.CLOSED && 
        this.failureCount >= this.circuitBreakerThreshold) {
      this.circuitBreakerState = CircuitBreakerState.OPEN;
      this.circuitBreakerOpenTime = Date.now();
      this.emit('circuitBreakerOpen');
      this.onCircuitBreakerOpen?.();
    }
  }

  private maybeCloseCircuitBreaker(): void {
    if (this.circuitBreakerState === CircuitBreakerState.HALF_OPEN) {
      this.circuitBreakerState = CircuitBreakerState.CLOSED;
      this.failureCount = 0;
      this.emit('circuitBreakerClose');
      this.onCircuitBreakerClose?.();
    }
  }

  public getCircuitBreakerState(): CircuitBreakerState {
    return this.circuitBreakerState;
  }

  public getFailureCount(): number {
    return this.failureCount;
  }

  public resetCircuitBreaker(): void {
    this.circuitBreakerState = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.circuitBreakerOpenTime = 0;
    this.emit('circuitBreakerReset');
  }

  public getWrappedTransport(): Transport {
    return this.wrappedTransport;
  }
}