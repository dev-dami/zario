# Zario Test Suite

This directory contains comprehensive unit tests for the Zario logging library.

## Quick Start

### Install Dependencies

```bash
npm install
```

### Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- FileTransport

# Run specific test suite
npm test -- --testNamePattern="Constructor"

# Run tests with verbose output
npm test -- --verbose
```

## Test Structure

```
tests/
├── testUtils.ts              # Test utilities and mocks
├── Logger.test.ts             # Core Logger class tests
├── LogLevel.test.ts           # Log level functionality tests  
├── Formatter.test.ts          # Output formatting tests
│
│
├── scripts                    #General script testing
│   ├── ValidatePackageJson.test.ts #Package.json check tests
├── transports/                # Transport implementation tests
│   ├── Transport.test.ts      # Base transport interface
│   ├── ConsoleTransport.test.ts # Console output tests
│   ├── FileTransport.test.ts    # File I/O and rotation tests
│   ├── HttpTransport.test.ts    # HTTP client tests
│   ├── RetryTransport.test.ts   # Retry logic tests
│   ├── CircuitBreakerTransport.test.ts # Circuit breaker behavior tests
│   └── DeadLetterQueue.test.ts # Dead letter queue tests
├── filters/                   # Filter implementation tests
│   ├── Filter.test.ts           # Base filter interface
│   ├── LevelFilter.test.ts       # Log level filtering tests
│   ├── MetadataFilter.test.ts    # Metadata-based filtering tests
│   └── CompositeFilter.test.ts  # Filter combination tests
├── aggregation/                # Aggregator tests
│   ├── LogAggregator.test.ts     # Base aggregator interface
│   ├── BatchAggregator.test.ts   # Batching logic tests
│   └── TimeBasedAggregator.test.ts # Time-based aggregation tests
├── structured/                 # Structured logging tests
│   ├── MetadataEnricher.test.ts  # Metadata enrichment tests
│   └── LogEnrichmentPipeline.test.ts # Pipeline composition tests
├── utils/                     # Utility tests
│   ├── ColorUtil.test.ts          # Color utility tests
│   ├── TimeUtil.test.ts           # Time formatting tests
│   └── Timer.test.ts             # Performance timer tests
└── integration.test.ts          # End-to-end integration tests
```

## Test Categories

### Unit Tests
- **Logger Core**: Test the main Logger class functionality
- **Transports**: Test each transport implementation independently
- **Filters**: Verify filtering logic and edge cases
- **Aggregators**: Test log batching and time-based aggregation
- **Structured Logging**: Test metadata enrichment and pipelines
- **Utilities**: Test helper functions and utilities

### Integration Tests
- **Transport Combinations**: Test multiple transports working together
- **End-to-End Scenarios**: Real-world usage patterns
- **Error Recovery**: Test circuit breaker, retry, and dead letter scenarios
- **Performance**: Test async mode and high-throughput scenarios

## Coverage

Tests aim for comprehensive coverage of:
- All public APIs and methods
- Error handling paths and edge cases
- Configuration validation
- Transport interaction patterns
- Async/sync operation modes

## Test Utilities

The `testUtils.ts` file provides common test utilities:

```typescript
// Mock transport for testing
export class MockTransport implements Transport {
  writeCalls: LogData[] = [];
  
  write(data: LogData, formatter: Formatter): void {
    this.writeCalls.push({ ...data, formatter });
  }
  
  // Test helper methods
  getWriteCalls(): LogData[] {
    return this.writeCalls;
  }
  
  reset(): void {
    this.writeCalls = [];
  }
}

// Test logger factory
export function createTestLogger(options?: LoggerOptions): Logger {
  return new Logger({
    level: "debug",
    colorize: false,
    transports: [new MockTransport()],
    ...options
  });
}
```

## Troubleshooting

### Common Issues

**Tests timing out**
- Some integration tests make real HTTP calls and may timeout
- Use `--testTimeout=30000` to increase timeout if needed

**File system permissions**
- File transport tests require write permissions in `/tmp` directory
- On Windows, ensure proper temp directory access

**Port conflicts**
- Integration tests may conflict with running services
- Use different ports for parallel test execution

**Memory usage**
- Large test suites may consume significant memory
- Use `--maxWorkers=1` to limit parallel test workers

### Running Specific Tests

```bash
# Run only transport tests
npm test -- transports

# Run only circuit breaker tests  
npm test -- --testNamePattern="CircuitBreaker"

# Run with different timeout
npm test -- --testTimeout=60000 --verbose
```

## Best Practices

1. **Test Isolation**: Each test should be independent and not rely on global state
2. **Mock External Dependencies**: Use MockTransport for tests that don't need real I/O
3. **Clean Resources**: Always clean up resources in `afterEach` blocks
4. **Assert All Outcomes**: Test both success and failure paths
5. **Use Test Utilities**: Leverage common utilities to reduce test duplication
6. **Coverage Requirements**: Maintain >80% coverage for new features