import type { OTelContext, OTelContextProvider } from '../types/OpenTelemetryTypes.js';

let cachedProvider: OTelContextProvider | null = null;

class DefaultOTelProvider implements OTelContextProvider {
  private otelApi: any = null;
  private checked = false;

  private tryLoadOTel(): void {
    if (this.checked) return;
    this.checked = true;
    
    try {
      this.otelApi = require('@opentelemetry/api');
    } catch {
      this.otelApi = null;
    }
  }

  isAvailable(): boolean {
    this.tryLoadOTel();
    return this.otelApi !== null;
  }

  getContext(): OTelContext | null {
    this.tryLoadOTel();
    if (!this.otelApi) return null;

    const span = this.otelApi.trace.getActiveSpan?.();
    if (!span) return null;

    const spanContext = span.spanContext();
    if (!spanContext) return null;

    const result: OTelContext = {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
    };

    if (spanContext.traceFlags !== undefined) {
      result.traceFlags = spanContext.traceFlags;
    }

    const parentSpan = this.otelApi.trace.getSpan?.(
      this.otelApi.context.active()
    );
    if (parentSpan && parentSpan !== span) {
      const parentContext = parentSpan.spanContext();
      if (parentContext?.spanId) {
        result.parentSpanId = parentContext.spanId;
      }
    }

    try {
      const baggage = this.otelApi.propagation.getBaggage?.(
        this.otelApi.context.active()
      );
      if (baggage) {
        const baggageEntries: Record<string, string> = {};
        baggage.getAllEntries().forEach((entry: [string, { value: string }]) => {
          baggageEntries[entry[0]] = entry[1].value;
        });
        if (Object.keys(baggageEntries).length > 0) {
          result.baggage = baggageEntries;
        }
      }
    } catch {
    }

    return result;
  }
}

class NoOpProvider implements OTelContextProvider {
  isAvailable(): boolean {
    return false;
  }

  getContext(): OTelContext | null {
    return null;
  }
}

export function getOTelProvider(): OTelContextProvider {
  if (!cachedProvider) {
    cachedProvider = new DefaultOTelProvider();
  }
  return cachedProvider;
}

export function setOTelProvider(provider: OTelContextProvider): void {
  cachedProvider = provider;
}

export function resetOTelProvider(): void {
  cachedProvider = null;
}

export { NoOpProvider, DefaultOTelProvider };
export type { OTelContextProvider };
