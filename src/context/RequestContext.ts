import { AsyncLocalStorage } from 'async_hooks';
import type { RequestContextData } from '../types/OpenTelemetryTypes.js';

type ContextStore = Map<string, unknown>;

class RequestContextManager {
  private storage = new AsyncLocalStorage<ContextStore>();

  run<T>(context: RequestContextData, fn: () => T): T {
    const store = new Map(Object.entries(context));
    return this.storage.run(store, fn);
  }

  runAsync<T>(context: RequestContextData, fn: () => Promise<T>): Promise<T> {
    const store = new Map(Object.entries(context));
    return this.storage.run(store, fn);
  }

  get<K extends keyof RequestContextData>(key: K): RequestContextData[K] | undefined {
    const store = this.storage.getStore();
    return store?.get(key as string) as RequestContextData[K] | undefined;
  }

  getAll(): RequestContextData {
    const store = this.storage.getStore();
    if (!store) return {};
    return Object.fromEntries(store);
  }

  set(key: string, value: unknown): void {
    const store = this.storage.getStore();
    store?.set(key, value);
  }

  has(key: string): boolean {
    const store = this.storage.getStore();
    return store?.has(key) ?? false;
  }

  delete(key: string): boolean {
    const store = this.storage.getStore();
    return store?.delete(key) ?? false;
  }

  isActive(): boolean {
    return this.storage.getStore() !== undefined;
  }
}

export const RequestContext = new RequestContextManager();
export type { RequestContextData };
