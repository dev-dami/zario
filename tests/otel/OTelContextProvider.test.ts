import {
  getOTelProvider,
  setOTelProvider,
  resetOTelProvider,
  NoOpProvider,
} from '../../src/otel/OTelContextProvider';
import type { OTelContext, OTelContextProvider } from '../../src/types/OpenTelemetryTypes';

describe('OTelContextProvider', () => {
  afterEach(() => {
    resetOTelProvider();
  });

  describe('NoOpProvider', () => {
    it('should return false for isAvailable', () => {
      const provider = new NoOpProvider();
      expect(provider.isAvailable()).toBe(false);
    });

    it('should return null for getContext', () => {
      const provider = new NoOpProvider();
      expect(provider.getContext()).toBeNull();
    });
  });

  describe('getOTelProvider', () => {
    it('should return same provider instance on multiple calls', () => {
      const provider1 = getOTelProvider();
      const provider2 = getOTelProvider();
      expect(provider1).toBe(provider2);
    });

    it('should return provider that reports unavailable when @opentelemetry/api not installed', () => {
      const provider = getOTelProvider();
      expect(provider.isAvailable()).toBe(false);
    });
  });

  describe('setOTelProvider', () => {
    it('should allow setting custom provider', () => {
      const mockContext: OTelContext = {
        traceId: 'test-trace-id-12345678901234567890123456789012',
        spanId: 'test-span-1234567890123456',
        traceFlags: 1,
      };

      const customProvider: OTelContextProvider = {
        isAvailable: () => true,
        getContext: () => mockContext,
      };

      setOTelProvider(customProvider);
      const provider = getOTelProvider();

      expect(provider.isAvailable()).toBe(true);
      expect(provider.getContext()).toEqual(mockContext);
    });

    it('should allow resetting to default provider', () => {
      const customProvider: OTelContextProvider = {
        isAvailable: () => true,
        getContext: () => ({ traceId: 'test', spanId: 'test' }),
      };

      setOTelProvider(customProvider);
      expect(getOTelProvider().isAvailable()).toBe(true);

      resetOTelProvider();
      expect(getOTelProvider().isAvailable()).toBe(false);
    });
  });

  describe('mock OTel integration', () => {
    it('should extract full context with baggage', () => {
      const mockContext: OTelContext = {
        traceId: 'abc123def456789012345678901234567890',
        spanId: '1234567890abcdef',
        traceFlags: 1,
        parentSpanId: 'parent123456789',
        baggage: {
          userId: 'user-123',
          tenantId: 'tenant-456',
        },
      };

      const customProvider: OTelContextProvider = {
        isAvailable: () => true,
        getContext: () => mockContext,
      };

      setOTelProvider(customProvider);
      const provider = getOTelProvider();

      const context = provider.getContext();
      expect(context).not.toBeNull();
      expect(context?.traceId).toBe('abc123def456789012345678901234567890');
      expect(context?.spanId).toBe('1234567890abcdef');
      expect(context?.traceFlags).toBe(1);
      expect(context?.parentSpanId).toBe('parent123456789');
      expect(context?.baggage).toEqual({
        userId: 'user-123',
        tenantId: 'tenant-456',
      });
    });
  });
});
