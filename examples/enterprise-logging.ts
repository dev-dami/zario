🧹 Nitpick comments (10)
README.md (1)
35-35: LGTM! Consider consistent naming for Circuit Breaker.

The addition accurately reflects the new transport capabilities. The naming "CircuitBreaker" (one word) should be consistent across documentation.

Consider using "Circuit Breaker" (two words) for better readability if that's the convention used in API documentation, or ensure "CircuitBreaker" is used consistently everywhere.

examples/retry-example.ts (2)
1-6: Document that URL intentionally fails for demo purposes.

The example uses https://httpbin.org/status/500 which always returns an error. While this effectively demonstrates retry behavior, it should be documented with a comment explaining this is intentional.

📝 Add explanatory comment
+// Using an endpoint that returns 500 to demonstrate retry behavior
 const httpTransport = new HttpTransport({
   url: 'https://httpbin.org/status/500',
   timeout: 5000
 });
35-36: Add graceful shutdown for async operations.

The example logs messages but exits immediately without waiting for async operations to complete. In async mode, logs may be lost if the process terminates before they're written.

⏳ Add graceful shutdown
 logger.info('Testing retry mechanism');
 logger.error('This will fail and retry');
+
+// Wait for async operations to complete
+setTimeout(() => {
+  console.log('Example completed');
+  process.exit(0);
+}, 10000); // Allow time for retries to complete
src/transports/Transport.ts (1)
7-7: Remove the redundant isAsyncSupported() method — it's never used in the codebase.

The Logger's async handling (lines 309-326) directly checks if (transport.writeAsync) to determine whether to call async operations. The isAsyncSupported() method is implemented in DeadLetterQueue and CircuitBreakerTransport but is never invoked anywhere in the source code. Since the presence of the writeAsync method already indicates async capability, this method is dead code that should be removed.

examples/enterprise-logging.ts (1)
100-107: Prefer dynamic import() over require() for consistency.

The file uses ES module syntax elsewhere but uses require('fs') here. Use dynamic import for consistency with the rest of the codebase.

♻️ Proposed fix
-    const fs = require('fs');
-    fs.writeFileSync('./logs/emergency-fallback.log', JSON.stringify({
+    const fs = await import('fs');
+    fs.default.writeFileSync('./logs/emergency-fallback.log', JSON.stringify({
tests/DeadLetterQueue.test.ts (2)
225-264: Test creates unused instance, reducing clarity.

The first deadLetterQueue instance created with mockTransport (lines 228-233) is immediately replaced by a second instance with failingTransport (lines 242-245). This is confusing and the first instance serves no purpose.

♻️ Proposed fix
   describe('getDeadLetters method', () => {
     it('should return copy of dead letters', () => {
       const onDeadLetter = jest.fn();
-      const options: DeadLetterQueueOptions = {
-        transport: mockTransport,
-        onDeadLetter
-      };
-      
-      deadLetterQueue = new DeadLetterQueue(options);
-      
       const failingTransport = {
         write: jest.fn().mockImplementation(() => {
           throw Object.assign(new Error('Auth error'), { code: 'EAUTH' });
         }),
         isAsyncSupported: () => false
       };
       
       deadLetterQueue = new DeadLetterQueue({
         transport: failingTransport as any,
         onDeadLetter
       });
309-361: Test silently ignores failures, reducing test reliability.

The test at lines 349-359 catches and swallows all errors with a comment about environments. This means the test provides no coverage when the file system isn't available. Consider mocking fs or marking the test as conditional.

♻️ Proposed approach using fs mock
// Mock fs at the top of the describe block
jest.mock('fs', () => ({
  promises: {
    appendFile: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockResolvedValue('{"deadLetterReason":"Write error","originalError":"EIO"}\n'),
  }
}));

// Then in the test, verify the mock was called correctly:
expect(fs.promises.appendFile).toHaveBeenCalledWith(
  deadLetterFile,
  expect.stringContaining('"deadLetterReason":"Write error"')
);
src/transports/RetryTransport.ts (2)
174-176: Redundant maybeOpenCircuitBreaker() call.

incrementFailureCount() (line 175) already calls maybeOpenCircuitBreaker() internally (line 244), so the explicit call at line 176 is redundant.

♻️ Proposed fix
     this.incrementFailureCount();
-    this.maybeOpenCircuitBreaker();

     const errorContext = {
Also applies to: 242-245

31-35: Circuit breaker state naming is inverted from standard terminology.

In standard circuit breaker patterns, "CLOSED" means healthy/allowing requests, and "OPEN" means tripped/rejecting requests. This implementation inverts the terminology, which may confuse users familiar with the pattern.

Consider renaming for clarity or adding documentation explaining the naming choice.

Also applies to: 230-240

src/core/Logger.ts (1)
29-29: Use proper typing instead of any.

deadLetterQueue?: any should use a proper type. If the DeadLetterQueue type is available, use it; otherwise, define an interface.

♻️ Proposed fix
+import { DeadLetterQueue } from "../transports/DeadLetterQueue.js";
 // ...
-  deadLetterQueue?: any;
+  deadLetterQueue?: DeadLetterQueue;