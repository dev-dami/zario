import { Logger, CircuitBreakerTransport, DeadLetterQueue, HttpTransport, FileTransport } from '../src/index';

// Placeholder implementations for monitoring and alerting
function sendMetricsToMonitoring(data: { metric: string; value: number; tags: string[] }): void {
  console.log('METRICS:', JSON.stringify(data));
  // In production, wire to real monitoring SDK like DataDog, New Relic, etc.
}

function sendAlert(message: string): void {
  console.log('ALERT:', message);
  // In production, wire to real alerting system like PagerDuty, Slack, etc.
}

// Advanced Enterprise Logging Setup with Circuit Breaker and Dead Letter Queue
const logger = new Logger({
  level: 'info',
  colorize: true,
  transports: [
    // Primary HTTP transport with circuit breaker
    new CircuitBreakerTransport(
      new HttpTransport({
        url: 'https://logs.example.com/ingest',
        method: 'POST',
        headers: {
          'Authorization': 'Bearer your-api-key',
          'Content-Type': 'application/json'
        },
        timeout: 5000,
        retries: 2
      }),
      {
        threshold: 5,                    // Trip after 5 failures
        timeout: 60000,                  // Wait 1 minute before retry
        resetTimeout: 300000,              // Auto-reset after 5 minutes
        onStateChange: (from, to) => {
          console.warn(`Circuit breaker: ${from} → ${to}`);
          // Could trigger alerts, send metrics, etc.
        },
        onTrip: (failureCount) => {
          console.error(`Circuit tripped after ${failureCount} failures`);
          // Could send PagerDuty alert, Slack notification, etc.
        },
        onReset: () => {
          console.info('Circuit breaker reset - service recovered');
          // Could send recovery notification
        }
      }
    ),
    
    // Dead letter queue for failed HTTP logs
    new DeadLetterQueue({
      transport: new HttpTransport({
        url: 'https://logs.example.com/ingest',
        method: 'POST',
        headers: { 'Authorization': 'Bearer your-api-key' },
        timeout: 3000,
        retries: 1
      }),
      maxRetries: 3,
      retryableErrorCodes: [
        'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND',
        'HPE_INVALID_CONSTANT', 'EAI_AGAIN' // Additional network errors
      ],
      deadLetterFile: './logs/dead-letters.jsonl',
      onDeadLetter: (deadLetter) => {
        console.error('CRITICAL: Log lost to dead letter queue:', {
          message: deadLetter.message,
          level: deadLetter.level,
          reason: deadLetter.deadLetterReason,
          retryCount: deadLetter.retryCount,
          failedAt: deadLetter.failedAt
        });
        
        // Advanced dead letter handling:
        // 1. Store in secondary storage (S3, DynamoDB)
        // 2. Send to monitoring service (DataDog, New Relic)
        // 3. Trigger alerts for critical logs
        // 4. Queue for manual recovery
      }
    }),
    
    // Local file backup (always succeeds)
    new FileTransport({
      path: './logs/app-backup.log',
      maxSize: 50 * 1024 * 1024, // 50MB
      maxFiles: 10,
      compression: 'gzip',
      batchInterval: 1000 // Buffer for 1 second
    })
  ]
});

// Example: Critical error handling with enterprise features
async function handleCriticalError(error: Error, context: any) {
  try {
    // Try primary logging (may fail)
    await logger.fatal('Critical system error', {
      error: error.message,
      stack: error.stack,
      context,
      service: 'payment-processor',
      version: '2.1.0',
      environment: process.env.NODE_ENV || 'unknown'
    });
    
    console.log('✅ Critical log sent successfully');
    
  } catch (loggingError) {
    console.error('❌ EVEN WORSE: Logging system failed:', loggingError);
    
    // Fallback: Try to write to local file directly
    const fs = require('fs');
    fs.writeFileSync('./logs/emergency-fallback.log', JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'fatal',
      message: 'Logging system failure - original error was: ' + error.message,
      context
    }) + '\n');
  }
}

// Example: Monitoring and metrics collection
function collectLoggingMetrics() {
  // Get metrics from circuit breaker if available
  const transports = logger.getTransports?.() || [];
  const circuitBreakerTransports = transports.filter(t => 
    t instanceof CircuitBreakerTransport
  );
  
  circuitBreakerTransports.forEach((cb, index) => {
    const metrics = cb.getMetrics();
    
    // Guard against zero division
    let successRate = "0.00%";
    let failureRate = "0.00%";
    let avgResponseTime = "0.00ms";
    
    if (metrics.totalRequests > 0) {
      successRate = ((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2) + '%';
      failureRate = ((metrics.failedRequests / metrics.totalRequests) * 100).toFixed(2) + '%';
      avgResponseTime = metrics.averageResponseTime.toFixed(2) + 'ms';
    }
    
    console.log(`Circuit Breaker ${index} Metrics:`, {
      totalRequests: metrics.totalRequests,
      successRate,
      failureRate,
      currentState: metrics.currentState,
      avgResponseTime
    });
    
    // Send metrics to monitoring system
    if (metrics.failedRequests > 0) {
      sendMetricsToMonitoring({
        metric: 'logging_failures',
        value: metrics.failedRequests,
        tags: [`transport:${index}`, `state:${metrics.currentState}`]
      });
    }
  });
  
  // Get dead letter queue metrics
  const deadLetterTransports = transports.filter(t => 
    t instanceof DeadLetterQueue
  );
  
  deadLetterTransports.forEach((dlq, index) => {
    const deadLetters = dlq.getDeadLetters();
    if (deadLetters.length > 0) {
      console.warn(`Dead Letter Queue ${index}: ${deadLetters.length} lost logs`);
      
      // Analyze dead letters for patterns
      const errorCodes = deadLetters.map(dl => dl.originalError).filter(Boolean);
      const errorCounts = errorCodes.reduce((acc, code) => {
        acc[code!] = (acc[code!] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log('Error patterns in dead letters:', errorCounts);
      
      // Could trigger different alerts based on error patterns
      if (errorCounts['ECONNREFUSED'] > 5) {
        sendAlert('Network connectivity issues detected');
      }
    }
  });
}

// Example: Graceful shutdown with cleanup
async function gracefulShutdown() {
  console.log('🔄 Starting graceful shutdown...');
  
  try {
    // Flush any pending logs
    await logger.flushAggregators();
    
    // Get final metrics
    collectLoggingMetrics();
    
    // Cleanup transports
    const transports = logger.getTransports?.() || [];
    for (const transport of transports) {
      if (typeof transport.destroy === 'function') {
        await (transport as any).destroy();
      }
    }
    
    console.log('✅ Graceful shutdown complete');
    
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Setup process handlers
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Example usage
console.log('🚀 Enterprise logging system started');

// Simulate various scenarios
async function demonstrateEnterpriseLogging() {
  console.log('\n📝 Demonstrating enterprise logging features...\n');
  
  // Normal logging
  await logger.info('Application started', {
    service: 'enterprise-demo',
    version: '1.0.0',
    port: 3000,
    environment: 'production'
  });
  
  // Simulate some failures to trigger circuit breaker
  for (let i = 0; i < 8; i++) {
    try {
      await logger.warn(`Simulated warning ${i}`, {
        warningCode: 'SIM_' + i,
        severity: i < 4 ? 'low' : 'high'
      });
    } catch (e) {
      console.log(`Log ${i} failed (expected):`, e.message);
    }
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  // Wait and show metrics
  await new Promise(resolve => setTimeout(resolve, 2000));
  collectLoggingMetrics();
  
  // Test critical error handling
  await handleCriticalError(
    new Error('Database connection pool exhausted'),
    { 
      query: 'SELECT * FROM users WHERE active = true',
      poolSize: 10,
      activeConnections: 10 
    }
  );
  
  console.log('\n✅ Demo complete. Check logs/ directory for outputs.');
}

// Run demo if this file is executed directly
if (require.main === module) {
  demonstrateEnterpriseLogging().catch(console.error);
}

export { handleCriticalError, collectLoggingMetrics, gracefulShutdown };