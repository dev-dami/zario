# Release Notes

## Version History

### [Current Version]

*Release Date: January 8, 2026*

#### New Features
- Enhanced enterprise logging example with monitoring and alerting integrations
- Improved circuit breaker transport with proper state semantics
- Added comprehensive dead letter queue implementation
- Enhanced retry transport with exponential backoff and jitter

#### 🛠️ Improvements
- Fixed circuit breaker state descriptions (CLOSED=normal, OPEN=tripped, HALF_OPEN=testing)
- Prevented double-wrapping of RetryTransport in Logger initialization
- Added zero-guard protection for rate calculations to prevent NaN
- Improved async transport write operations and error handling
- Simplified DeadLetterQueue retry logic by removing duplicate branches

#### 🐛 Bug Fixes
- Fixed shutdown error handling to exit with non-zero code on failure
- Fixed average response time calculation using actual operation duration
- Fixed createTransport to preserve instance configuration
- Fixed resetFailureCount to allow proper decay to 0
- Updated Logger class to support both `async` and `asyncMode` for backward compatibility
- Added missing Logger methods: `fatal()` and `getTransports()`

#### Documentation
- Updated transport documentation with comprehensive examples
- Enhanced test suite documentation and setup instructions
- Added performance considerations and best practices
- Fixed broken links and outdated API references

#### Breaking Changes
- LoggerOptions now supports both `async` and `asyncMode` (backward compatible)
- CircuitBreakerTransport state semantics aligned with industry standards
- DeadLetterQueue write() method now returns Promise<void> for consistency

#### Developer Experience
- Improved TypeScript type safety throughout codebase
- Enhanced error messages and debugging information
- Better examples that work out-of-the-box
- More comprehensive test coverage

---

## Migration Guide

### From Previous Versions

If upgrading from an earlier version, note these changes:

#### Logger Configuration
```typescript
// Old way (still supported)
const logger = new Logger({
  asyncMode: true  // Still works
});

// New preferred way  
const logger = new Logger({
  async: true     // Recommended
});
```

#### Circuit Breaker States
The state terminology has been standardized:
- **CLOSED**: Normal operation (previously was "OPEN")
- **OPEN**: Tripped/fast-fail (previously was "CLOSED") 
- **HALF_OPEN**: Testing state (unchanged)

#### Transport Methods
Some transport interfaces have been enhanced:
- DeadLetterQueue.write() now returns Promise<void> for async consistency
- CircuitBreakerTransport response time calculations fixed
- RetryTransport double-wrapping prevention implemented

---

## Links

- [GitHub Repository](https://github.com/Dev-Dami/zario)
- [NPM Package](https://www.npmjs.com/package/zario)
- [Issue Tracker](https://github.com/Dev-Dami/zario/issues)
- [Documentation](./docs/README.md)