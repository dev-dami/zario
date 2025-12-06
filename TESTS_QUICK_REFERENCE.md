# HttpTransport Tests - Quick Reference Guide

## 🚀 Quick Start

```bash
# Run all tests
npm test

# Run only HttpTransport tests
npm test HttpTransport

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

## 📁 Test Files Overview

| File | Tests | Purpose |
|------|-------|---------|
| `HttpTransport.test.ts` | 58 | Core HttpTransport functionality |
| `Logger.HttpTransport.integration.test.ts` | 12 | Integration with Logger |
| `TransportFactories.test.ts` | 14 | Factory functions |
| `index.test.ts` | 15 | Package exports |
| **TOTAL** | **99** | **Complete test suite** |

## 🎯 Test Categories

### HttpTransport.test.ts

```typescript
describe('HttpTransport', () => {
  describe('Constructor')                    // 10 tests
  describe('HTTPS Protocol Support')         // 3 tests
  describe('Retry Logic')                    // 3 tests
  describe('HTTP Status Codes')              // 12 tests
  describe('HTTP Methods')                   // 5 tests
  describe('URL Handling')                   // 3 tests
  describe('Headers Handling')               // 4 tests
  describe('Edge Cases')                     // 7 tests
  describe('Factory Function httpT()')       // 3 tests
  describe('Integration with Logger')        // 3 tests
  describe('Data Formatting')                // 3 tests
  describe('write() - Synchronous')          // Original
  describe('writeAsync() - Asynchronous')    // Original
});
```

### Logger.HttpTransport.integration.test.ts

```typescript
describe('Logger + HttpTransport Integration', () => {
  describe('Basic Integration')         // 2 tests
  describe('Multiple Transports')       // 1 test
  describe('Async Mode')                // 2 tests
  describe('Child Loggers')             // 1 test
  describe('Log Levels')                // 1 test
  describe('Metadata and Prefixes')     // 2 tests
  describe('Error Scenarios')           // 1 test
  describe('High-Volume Logging')       // 1 test
  describe('JSON and Formatting')       // 1 test
});
```

## 🔍 Key Test Scenarios

### ✅ Protocol Detection
```typescript
// Tests HTTPS URLs use https module
url: 'https://secure.example.com/logs'
expect(mockHttpsRequest).toHaveBeenCalled()

// Tests HTTP URLs use http module
url: 'http://example.com/logs'
expect(mockHttpRequest).toHaveBeenCalled()
```

### ✅ Retry Logic
```typescript
// Tests exponential backoff: 1s, 2s, 4s...
retries: 2
// Uses jest.useFakeTimers()
await jest.advanceTimersByTimeAsync(1000)
```

### ✅ Status Codes
```typescript
// Success: 200, 201, 204
statusCode: 200
expect(promise).resolves.toBeUndefined()

// Errors: 4xx, 5xx
statusCode: 400
expect(promise).rejects.toThrow('HTTP request failed')
```

### ✅ HTTP Methods
```typescript
method: 'GET'    // Also: POST, PUT, DELETE, PATCH
expect(mockHttpRequest).toHaveBeenCalledWith(
  expect.objectContaining({ method: 'GET' })
)
```

### ✅ URL Handling
```typescript
// Query parameters
url: 'http://example.com/logs?api_key=secret'
expect(path).toBe('/logs?api_key=secret')

// Nested paths
url: 'http://example.com/api/v2/logs'
expect(path).toBe('/api/v2/logs')
```

### ✅ Headers
```typescript
headers: {
  'Authorization': 'Bearer token',
  'Content-Type': 'application/json'
}
expect(mockHttpRequest).toHaveBeenCalledWith(
  expect.objectContaining({ headers: expect.objectContaining(...) })
)
```

### ✅ Error Scenarios
```typescript
// DNS errors
error: 'getaddrinfo ENOTFOUND'

// Connection refused
error: 'connect ECONNREFUSED'

// Timeout
on('timeout', callback)
expect(promise).rejects.toThrow('Request timeout')
```

## 🧪 Test Patterns Used

### Mock Request/Response
```typescript
const mockRes = {
  statusCode: 200,
  on: jest.fn().mockImplementation((event, callback) => {
    if (event === 'data' || event === 'end') {
      setImmediate(() => callback());
    }
    return mockRes;
  })
};

const mockReq = {
  on: jest.fn().mockImplementation((event, callback) => {
    if (event === 'response') {
      setImmediate(() => callback(mockRes));
    }
    return mockReq;
  }),
  write: jest.fn(),
  end: jest.fn()
};

mockHttpRequest.mockReturnValue(mockReq);
```

### Capturing Request Body
```typescript
let capturedBody = '';
write: jest.fn().mockImplementation((data) => {
  capturedBody = data;
})

// Later:
const parsedBody = JSON.parse(capturedBody);
expect(parsedBody.message).toBe('...');
```

### Testing Async with Timers
```typescript
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const promise = transport.writeAsync(...);
await jest.advanceTimersByTimeAsync(1000);
```

## 📊 Coverage Checklist

- [x] Constructor validation
- [x] HTTP/HTTPS protocol detection
- [x] All HTTP methods
- [x] All status code ranges (2xx, 4xx, 5xx)
- [x] Retry logic with exponential backoff
- [x] Timeout handling
- [x] Network errors (DNS, connection)
- [x] URL parsing (paths, queries)
- [x] Header handling
- [x] Content-Length calculation
- [x] Sync vs Async modes
- [x] Integration with Logger
- [x] Multiple transports
- [x] Child loggers
- [x] Log level filtering
- [x] Metadata handling
- [x] Large payloads
- [x] Special characters
- [x] Unicode support
- [x] Factory functions
- [x] Package exports

## 🐛 Common Issues & Solutions

### Issue: Tests timing out
**Solution:** Check if mocks are properly triggering callbacks with `setImmediate()`

### Issue: Fake timers not working
**Solution:** Ensure `jest.useFakeTimers()` in `beforeEach()` and `jest.useRealTimers()` in `afterEach()`

### Issue: Mock not being called
**Solution:** Add `await new Promise(resolve => setTimeout(resolve, 100))` for sync mode tests

### Issue: Brace mismatch errors
**Solution:** Check for unmatched braces in template literals and string content

## 📖 Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Node.js HTTP Module](https://nodejs.org/api/http.html)
- [Node.js HTTPS Module](https://nodejs.org/api/https.html)

---

**Last Updated:** December 6, 2024  
**Version:** 1.0.0  
**Status:** ✅ Ready for Production