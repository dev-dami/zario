import { Logger, RetryTransport, HttpTransport, ConsoleTransport } from '../src/index';

const httpTransport = new HttpTransport({
  url: 'https://httpbin.org/status/500',
  timeout: 5000
});

const retryTransport = new RetryTransport({
  wrappedTransport: httpTransport,
  maxAttempts: 3,
  baseDelay: 1000,
  backoffMultiplier: 2,
  jitter: true,
  circuitBreakerThreshold: 5,
  onRetryAttempt: (attempt, error, delay) => {
    console.log(`Retry attempt ${attempt} after ${delay}ms: ${error.message}`);
  },
  onRetryExhausted: (lastError, attempts) => {
    console.error(`All ${attempts} attempts failed:`, lastError.message);
  },
  onCircuitBreakerOpen: () => {
    console.log('Circuit breaker opened');
  },
  onCircuitBreakerClose: () => {
    console.log('Circuit breaker closed');
  }
});

const logger = new Logger({
  level: 'info',
  transports: [retryTransport, new ConsoleTransport()],
  asyncMode: true
});

logger.info('Testing retry mechanism');
logger.error('This will fail and retry');