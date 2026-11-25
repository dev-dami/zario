import type { LogLevel } from "./LogLevel.js";
import { Formatter } from "./Formatter.js";
import type { QueueProvider, MemoryQueueOptions } from "./LogQueue.js";
import type { Transport } from "../transports/Transport.js";
import { TransportConfig, LogData } from "../types/index.js";
import type { Filter } from "../filters/Filter.js";
import type { LogAggregator } from "../aggregation/LogAggregator.js";
import type { LogEnricher, LogEnrichmentPipeline } from "../structured/StructuredExtensions.js";
import type { RetryTransportOptions } from "../transports/RetryTransport.js";
import { Timer } from "../utils/Timer.js";
import { Redactor, toRedactOptions } from "../utils/Redactor.js";
import { toPlain } from "../utils/serialize.js";
import type { RedactOptions } from "../utils/Redactor.js";
// Type only: node:crypto stays out of the lean zario/logger bundle.
import type { FieldEncryptor } from "../utils/FieldEncryptor.js";
import { ConsoleTransport } from "../transports/ConsoleTransport.js";
import { EventEmitter } from "events";

const NOOP = () => {};
// The index of a level is its priority. "silent" is the exception: it is above all others.
const LEVELS = ["silent", "boring", "debug", "info", "warn", "error", "fatal"];

interface EnrichmentPipelineLike {
  add(enricher: LogEnricher): EnrichmentPipelineLike;
  process(logData: LogData): LogData;
  getEnrichers(): LogEnricher[];
}

function createPipeline(list: LogEnricher[] = []): EnrichmentPipelineLike {
  return {
    add(enricher) {
      list.push(enricher);
      return this;
    },
    process: (data) => list.length ? list.reduce((current, enricher) => enricher(current), data) : data,
    getEnrichers: () => [...list],
  };
}

function isError(value: unknown): boolean {
  try {
    return value instanceof Error;
  } catch {
    return false;
  }
}

function hasKeys(value: object): boolean {
  for (const key in value) {
    if (Object.hasOwn(value, key)) return true;
  }
  return false;
}

/** The LOG_LEVEL variable, if it is a level. A wrong value must not stop the app. */
function envLevel(): LogLevel | undefined {
  const level = process.env.LOG_LEVEL?.toLowerCase();
  return level && LEVELS.includes(level) ? level : undefined;
}

/** Remove one item, and say whether it was there. */
function remove<T>(list: T[], item: T): boolean {
  const index = list.indexOf(item);
  if (index !== -1) list.splice(index, 1);
  return index !== -1;
}

/** Run every action, then throw the first failure. */
async function settle(actions: Array<() => unknown>): Promise<void> {
  const results = await Promise.allSettled(actions.map(async (action) => { await action(); }));
  for (const result of results) {
    if (result.status === "rejected") throw result.reason;
  }
}

/** Supported calls: message + metadata, metadata + message, or an Error. */
export type LogInput = string | Error | Record<string, unknown>;
export type LogDetails = string | Error | Record<string, unknown>;

/** Log a message, structured fields, or an Error with diagnostic details. */
export interface LogMethod {
  (message: string, metadata?: Record<string, unknown> | Error): void;
  (error: Error, messageOrMetadata?: string | Record<string, unknown>): void;
  (metadata: Record<string, unknown>, message?: string): void;
}

export type LoggerRetryOptions = Omit<RetryTransportOptions, "wrappedTransport">;
export type RetryTransportFactory = (options: RetryTransportOptions) => Transport;

interface RetryWrappedTransport {
  __zarioRetryTransport?: boolean;
}

export interface LoggerOptions {
  level?: LogLevel;
  colorize?: boolean;
  json?: boolean;
  transports?: TransportConfig[];
  timestampFormat?: string;
  prefix?: string;
  timestamp?: boolean;
  context?: Record<string, unknown>;
  parent?: Logger;
  asyncMode?: boolean;
  async?: boolean;
  customLevels?: { [level: string]: number };
  customColors?: { [level: string]: string };
  filters?: Filter[];
  aggregators?: LogAggregator[];
  enrichers?: LogEnrichmentPipeline;
  retryOptions?: LoggerRetryOptions;
  /** Field paths to censor: `["password", "**.token"]`, or an object to set the censor text. */
  redact?: RedactOptions | readonly string[];
  /** Encrypt metadata fields before any transport sees them. Runs after redaction. */
  encryptor?: FieldEncryptor;
  queueProvider?: QueueProvider;
  queueOptions?: MemoryQueueOptions;
}

export class Logger extends EventEmitter {
  declare silent: LogMethod;
  declare boring: LogMethod;
  declare debug: LogMethod;
  declare info: LogMethod;
  declare warn: LogMethod;
  declare error: LogMethod;
  declare fatal: LogMethod;

  private _ownsResources = true;
  private _closed = false;
  private _closePromise?: Promise<void>;
  private _parentLogger: Logger | undefined;
  private readonly _children = new Set<Logger>();
  private level: LogLevel;
  private transports: Transport[];
  private formatter: Formatter;
  private _context: Record<string, unknown>;
  private _contextKeys: number = 0;
  private asyncMode: boolean;
  private _customLevels: { [level: string]: number };
  private _levelPriority: number = 0;
  private _filters: Filter[];
  private _aggregators: LogAggregator[];
  private _enrichers: EnrichmentPipelineLike;
  private _retryOptions: LoggerRetryOptions | undefined;
  private _redactor: Redactor | undefined;
  private _encryptors: FieldEncryptor[];
  private _queueProvider?: QueueProvider | undefined;
  private static _global: Logger;
  public static defaultTransportsFactory: ((isProd: boolean) => TransportConfig[]) | null = null;
  public static retryTransportFactory: RetryTransportFactory | null = null;
  public static defaultQueueProviderFactory: ((options?: MemoryQueueOptions) => QueueProvider) | null = null;
  public prefix: string;
  public timestamp: boolean;

  constructor(options: LoggerOptions = {}) {
    super();
    const { parent, transports = [] } = options;
    if (parent?.isClosed()) throw new Error("Cannot create a child of a closed logger");
    const env = process.env.NODE_ENV?.toLowerCase();
    const isProd = env === "production" || env === "prod";
    const inherited = parent?.formatter;

    this._parentLogger = parent;
    this.level = options.level ?? parent?.level ?? envLevel() ?? (isProd ? "warn" : "debug");
    this.prefix = options.prefix ?? parent?.prefix ?? "";
    this.timestamp = options.timestamp ?? parent?.timestamp ?? true;
    // The lean entry point has no queue, so production stays synchronous there.
    this.asyncMode = options.async ?? options.asyncMode ?? parent?.asyncMode ??
      (isProd && Logger.defaultQueueProviderFactory !== null);
    this._queueProvider = options.queueProvider ?? parent?._queueProvider;
    this._retryOptions = options.retryOptions;
    // A child adds to the protection of its parent. It cannot remove any.
    const { encryptor } = options;
    const redact = options.redact && toRedactOptions(options.redact);
    const inheritedRedactor = parent?._redactor;
    this._redactor = redact && inheritedRedactor
      ? new Redactor({
        paths: [...inheritedRedactor.paths, ...redact.paths],
        censor: redact.censor ?? inheritedRedactor.censor,
      })
      : redact ? new Redactor(redact) : inheritedRedactor;
    this._encryptors = [...(parent?._encryptors ?? []), ...(encryptor ? [encryptor] : [])];
    this._context = { ...parent?._context, ...options.context };
    this._customLevels = { ...parent?._customLevels, ...options.customLevels };
    this._filters = [...(parent?._filters ?? []), ...(options.filters ?? [])];
    this._aggregators = [...(parent?._aggregators ?? []), ...(options.aggregators ?? [])];
    // A child gets its own pipeline and transport list, so that it does not change the parent.
    this._enrichers = parent
      ? createPipeline([...parent._enrichers.getEnrichers(), ...(options.enrichers?.getEnrichers() ?? [])])
      : options.enrichers ?? createPipeline();
    this.transports = parent && !transports.length
      ? [...parent.transports]
      : this._initTransports(transports.length
        ? transports
        : Logger.defaultTransportsFactory?.(isProd) ?? [new ConsoleTransport()]);
    this.formatter = new Formatter({
      colorize: options.colorize ?? inherited?.isColorized() ?? !isProd,
      json: options.json ?? inherited?.isJson() ?? isProd,
      timestampFormat: options.timestampFormat ?? inherited?.getTimestampFormat() ?? "YYYY-MM-DD HH:mm:ss",
      timestamp: options.timestamp ?? inherited?.hasTimestamp() ?? true,
      customColors: { ...inherited?.getCustomColors(), ...options.customColors },
    });

    if (this.asyncMode) this._ensureQueue(options.queueOptions);

    this._contextKeys = Object.keys(this._context).length;
    this._levelPriority = this._threshold(this.level);

    Logger._global ??= this;

    this._bindLevelMethods();
    // Ordinary request children share resources and must not be retained by the
    // parent forever. Track only children whose own resources need shutdown.
    this._ownsResources = !parent ||
      this._queueProvider !== parent._queueProvider ||
      this.transports.some((transport) => !parent.transports.includes(transport)) ||
      this._aggregators.some((aggregator) => !parent._aggregators.includes(aggregator));
    if (this._ownsResources) parent?._retainChild(this);
  }

  private _retainChild(child: Logger): void {
    this._children.add(child);
    this._parentLogger?._retainChild(this);
  }

  private _releaseChild(child: Logger): void {
    this._children.delete(child);
    if (!this._children.size && !this._ownsResources) this._parentLogger?._releaseChild(this);
  }

  private _initTransports(transports: TransportConfig[]): Transport[] {
    return transports.map((transport) => {
      // A config that is not a transport instance used to be dropped, and the logger then wrote nowhere.
      if (typeof transport?.write !== "function") {
        throw new TypeError("Logger transports must be transport instances with a write() method");
      }
      if (!this._retryOptions || (transport as RetryWrappedTransport).__zarioRetryTransport) return transport;
      // Without a factory the option did nothing, so logs were lost with no sign of it.
      const retry = Logger.retryTransportFactory;
      if (!retry) throw new Error("retryOptions needs 'zario/full', or wrap the transport in a RetryTransport");
      return retry({ ...this._retryOptions, wrappedTransport: transport });
    });
  }

  private _ensureQueue(options?: MemoryQueueOptions): void {
    this._queueProvider ??= Logger.defaultQueueProviderFactory?.(options);
    if (!this._queueProvider) {
      throw new Error("Async mode needs a queueProvider, or import from 'zario/full'");
    }
  }

  private _shouldLog(level: LogLevel): boolean {
    const messageLevelPriority = this.getLevelPriority(level);
    return messageLevelPriority >= this._levelPriority;
  }

  private getLevelPriority(level: LogLevel): number {
    const priority = LEVELS.indexOf(level);
    return priority > 0 ? priority : priority ? this._customLevels[level] ?? 999 : Infinity;
  }

  // An unknown threshold used to turn off every level, with no sign of it.
  private _threshold(level: LogLevel): number {
    if (!LEVELS.includes(level) && !Object.hasOwn(this._customLevels, level)) throw new Error(`Unknown log level "${level}"`);
    return this.getLevelPriority(level);
  }

  private _bindLevelMethods(): void {
    LEVELS.forEach((name, priority) => {
      (this as any)[name] = priority && priority >= this._levelPriority
        ? this._logEnabled.bind(this, name as LogLevel)
        : NOOP;
    });
  }

  private _report(type: string, error: unknown, quiet?: boolean): void {
    const heard = this.listenerCount("error") > 0;
    if (!heard || !quiet) console.error(`Error in ${type}:`, error);
    try {
      if (heard) this.emit("error", { type, error });
    } catch (listenerError) {
      console.error("Error in error listener:", listenerError);
    }
  }

  private _log(
    level: LogLevel,
    message: LogInput,
    metadata?: LogDetails,
  ): void {
    if (level === "silent" || !this._shouldLog(level)) {
      return;
    }

    this._logEnabled(level, message, metadata);
  }

  private _logEnabled(
    level: LogLevel,
    input: LogInput,
    details?: LogDetails,
  ): void {
    if (this._closed || this._parentLogger?.isClosed()) return;
    let data: LogData = {
      level,
      message: typeof input === "string" ? input : typeof details === "string" ? details : "",
      timestamp: new Date(),
      metadata: undefined,
      prefix: this.prefix,
    };
    if (typeof input === "string" && details === undefined) {
      if (this._contextKeys) data.metadata = this._context;
    } else try {
      this._fill(data, input, details);
    } catch {
      // A getter or a proxy threw. Keep the same shape, so that redaction paths still match.
      const source = typeof input === "string" ? details : input;
      const plain = toPlain(source);
      data.metadata = {
        ...this._context,
        ...(isError(source) ? { err: plain } : plain !== null && typeof plain === "object" ? plain : { metadata: plain }),
      };
    }

    if (this._filters.length) for (const filter of this._filters) {
      try {
        if (!filter.shouldEmit(data)) return;
      } catch (error) {
        this._report("filter", error);
      }
    }
    try {
      data = this._enrichers.process(data) ?? data;
    } catch (error) {
      this._report("enricher", error);
    }

    // Redact after the enrichers, so that fields they add are also redacted.
    if (data.metadata && (this._redactor || this._encryptors.length)) {
      let metadata: Record<string, any> = data.metadata;
      try {
        if (this._redactor) metadata = this._redactor.redact(metadata);
        for (const encryptor of this._encryptors) metadata = encryptor.encrypt(metadata);
      } catch (error) {
        // No protection, so no metadata.
        metadata = { metadata: "[Redaction failed]" };
        this._report("redaction", error);
      }
      data = { ...data, metadata };
    }

    this._dispatch(data);

    if (this._aggregators.length) for (const aggregator of this._aggregators) {
      try {
        aggregator.aggregate(data, this.formatter);
      } catch (error) {
        this._report("aggregator", error);
      }
    }
  }

  private _fill(data: LogData, input: LogInput, details?: LogDetails): void {
    let metadata: Record<string, unknown> | undefined;
    if (typeof input === "string") {
      metadata = details instanceof Error ? { err: details } : typeof details === "object" ? details : { details };
    } else if (input instanceof Error) {
      if (typeof details !== "string") data.message = input.message;
      metadata = { ...(typeof details === "object" && !(details instanceof Error) ? details : {}), err: input };
    } else {
      metadata = input;
    }
    // Empty metadata is omitted.
    const hasMetadata = metadata && hasKeys(metadata);
    data.metadata = this._contextKeys
      ? hasMetadata ? { ...this._context, ...metadata } : this._context
      : hasMetadata ? metadata : undefined;
  }

  private _dispatch(logData: LogData): void {
    const transports = this.transports;
    if (this.asyncMode) {
      this._queueProvider!.enqueue(logData, this.formatter, transports);
      return;
    }
    // A failed transport must not throw into the caller or skip the other transports.
    for (let i = 0; i < transports.length; i++) {
      try {
        transports[i]!.write(logData, this.formatter);
      } catch (error) {
        this._report("transport", error, true);
      }
    }
  }

  /**
   * Generic log method that allows logging with custom levels
   */
  logWithLevel(level: LogLevel, message: string, metadata?: Record<string, unknown> | Error): void;
  logWithLevel(level: LogLevel, error: Error, messageOrMetadata?: string | Record<string, unknown>): void;
  logWithLevel(level: LogLevel, metadata: Record<string, unknown>, message?: string): void;
  logWithLevel(
    level: LogLevel,
    message: LogInput,
    metadata?: LogDetails,
  ): void {
    this._log(level, message, metadata);
  }

  /** Return the configured threshold, for framework logger adapters. */
  getLevel(): LogLevel {
    return this.level;
  }

  setLevel(level: LogLevel): void {
    this._levelPriority = this._threshold(level);
    this.level = level;
    this._bindLevelMethods();
  }

  setFormat(format: "text" | "json"): void {
    this.formatter.setJson(format === "json");
  }

  setAsyncMode(asyncMode: boolean): void {
    this.asyncMode = asyncMode;
    if (asyncMode && !this._queueProvider) {
      this._ensureQueue();
      this._claimResources();
    } else if (!asyncMode && this._queueProvider) {
      // A queue inherited from the parent stays in use by the parent. Only destroy a queue that this logger owns.
      if (this._queueProvider !== this._parentLogger?._queueProvider) {
        this._queueProvider.destroy().catch((err) => {
          console.error("Error destroying queue provider:", err);
        });
      }
      this._queueProvider = undefined;
    }
  }

  addTransport(transport: Transport): void {
    this.transports.push(transport);
    this._claimResources();
  }

  // A child that gets its own transport or queue after construction owns a resource,
  // so the parent must close the child on parent.close().
  private _claimResources(): void {
    if (this._parentLogger && !this._ownsResources) {
      this._ownsResources = true;
      this._parentLogger._retainChild(this);
    }
  }

  getTimestampSetting(): boolean {
    return this.timestamp;
  }

  static get global(): Logger {
    // A closed logger drops every log, so replace it.
    if (!Logger._global || Logger._global.isClosed()) {
      Logger._global = new Logger();
    }
    return Logger._global;
  }

  createChild(options: LoggerOptions = {}): Logger {
    return new Logger({ ...options, parent: this });
  }

  /** Create a scoped logger; per-call metadata overrides these bindings. */
  child(context: Record<string, unknown>, options: LoggerOptions = {}): Logger {
    return this.createChild({ ...options, context: { ...context, ...options.context } });
  }

  /** Check a level before computing expensive diagnostic metadata. */
  isLevelEnabled(level: LogLevel): boolean {
    return !this.isClosed() && level !== "silent" && this._shouldLog(level);
  }

  /** Whether this logger or its parent has started closing. */
  isClosed(): boolean {
    return this._closed || (this._parentLogger?.isClosed() ?? false);
  }

  /** Wait for queued logs, aggregators and transport buffers to finish. */
  async flush(): Promise<void> {
    // The transports flush after the queue, and also when the queue failed.
    const queued = this.flushAggregators();
    await queued.catch(NOOP);
    await settle([() => queued, ...[...new Set(this.transports)].map((transport) => () => transport.flush?.())]);
  }

  /**
   * Stop accepting logs, drain pending work and release owned resources.
   * Repeated calls share one promise. Children do not close inherited resources.
   */
  close(): Promise<void> {
    if (this._closePromise) return this._closePromise;
    this._closed = true;
    this._closePromise = this._closeResources();
    return this._closePromise;
  }

  /** Close at the end of a block: `await using log = zario()`. */
  [Symbol.asyncDispose](): Promise<void> {
    return this.close();
  }

  private async _closeResources(): Promise<void> {
    const failures: unknown[] = [];
    const attempt = async (action: () => void | Promise<void>): Promise<void> => {
      try { await action(); } catch (error) { failures.push(error); }
    };
    await Promise.all([...this._children].map((child) => attempt(() => child.close())));
    await attempt(() => this.flush());
    if (this._queueProvider && this._queueProvider !== this._parentLogger?._queueProvider) {
      await attempt(() => this._queueProvider!.destroy());
    }
    for (const transport of new Set(this.transports)) {
      if (this._parentLogger?.transports.includes(transport)) continue;
      await attempt(() => transport.close ? transport.close() : transport.destroy?.());
    }
    this._parentLogger?._releaseChild(this);
    if (failures.length) throw failures[0];
  }

  startTimer(name: string): Timer {
    return new Timer(name, (message, fields) => this.info(message, fields));
  }

  /**
   * Add a filter to the logger
   */
  addFilter(filter: Filter): void {
    this._filters.push(filter);
  }

  /**
   * Remove a filter from the logger
   */
  removeFilter(filter: Filter): boolean {
    return remove(this._filters, filter);
  }

  /**
   * Add an aggregator to the logger
   */
  addAggregator(aggregator: LogAggregator): void {
    this._aggregators.push(aggregator);
  }

  /**
   * Remove an aggregator from the logger
   */
  removeAggregator(aggregator: LogAggregator): boolean {
    return remove(this._aggregators, aggregator);
  }

  addEnricher(enricher: LogEnricher): void {
    this._enrichers.add(enricher);
  }

  /**
   * Flush all aggregators
   */
  async flushAggregators(): Promise<void> {
    await settle([
      () => this._queueProvider?.flush(),
      ...this._aggregators.map((aggregator) => () => aggregator.flush()),
    ]);
  }

  getTransports(): Transport[] {
    return this.transports;
  }
}

/**
 * Create a console logger with info enabled, synchronous writes, and no files.
 * Formatting follows NODE_ENV; explicit options override these defaults.
 */
export function zario(options: LoggerOptions = {}): Logger {
  return new Logger({
    ...options,
    level: options.level ?? envLevel() ?? "info",
    async: options.async ?? options.asyncMode ?? false,
    transports: options.transports?.length ? options.transports : [new ConsoleTransport()],
  });
}
