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
import { Redactor } from "../utils/Redactor.js";
import type { RedactOptions } from "../utils/Redactor.js";
import { EventEmitter } from "events";

class SimpleConsoleTransport implements Transport {
  write(data: LogData, formatter: Formatter): void {
    const output = formatter.format(data);
    switch (data.level) {
      case "error":
        console.error(output);
        break;
      case "warn":
        console.warn(output);
        break;
      default:
        console.log(output);
        break;
    }
  }
}


const NOOP = () => {};
const LEVEL_METHODS = ["silent", "boring", "debug", "info", "warn", "error", "fatal"] as const;

interface EnrichmentPipelineLike {
  add(enricher: LogEnricher): EnrichmentPipelineLike;
  process(logData: LogData): LogData;
  getEnrichers(): LogEnricher[];
}

class LocalEnrichmentPipeline implements EnrichmentPipelineLike {
  private enrichers: LogEnricher[];

  constructor(enrichers: LogEnricher[] = []) {
    this.enrichers = enrichers;
  }

  add(enricher: LogEnricher): LocalEnrichmentPipeline {
    this.enrichers.push(enricher);
    return this;
  }

  process(logData: LogData): LogData {
    const enrichers = this.enrichers;
    const count = enrichers.length;
    let data = logData;

    for (let i = 0; i < count; i++) {
      const enricher = enrichers[i];
      if (enricher) {
        data = enricher(data);
      }
    }

    return data;
  }

  getEnrichers(): LogEnricher[] {
    return [...this.enrichers];
  }
}

/** Supported calls: message + metadata, metadata + message, or an Error. */
export type LogInput = string | Error | Record<string, unknown>;
export type LogDetails = string | Error | Record<string, unknown>;

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
  deadLetterQueue?: any;
  retryOptions?: LoggerRetryOptions;
  redact?: RedactOptions;
  queueProvider?: QueueProvider;
  queueOptions?: MemoryQueueOptions;
}

export class Logger extends EventEmitter {
  private ownsResources = true;
  private closed = false;
  private closePromise?: Promise<void>;
  private parentLogger?: Logger;
  private readonly children = new Set<Logger>();
  private level: LogLevel;
  private transports: Transport[];
  private formatter: Formatter;
  private context: Record<string, unknown>;
  private _contextKeys: number = 0;
  private _hasEnrichers: boolean = false;
  private _requiresProcessing: boolean = false;
  private asyncMode: boolean;
  private customLevels: { [level: string]: number };
  private levelPriority: number = 0;
  private filters: Filter[];
  private aggregators: LogAggregator[];
  private enrichers: EnrichmentPipelineLike;
  private retryOptions: LoggerRetryOptions | undefined;
  private redactor: Redactor | undefined;
  private queueProvider?: QueueProvider | undefined;
  private static _global: Logger;
  public static defaultTransportsFactory: ((isProd: boolean) => TransportConfig[]) | null = null;
  public static retryTransportFactory: RetryTransportFactory | null = null;
  public static defaultQueueProviderFactory: ((options?: MemoryQueueOptions) => QueueProvider) | null = null;
  public prefix: string;
  public timestamp: boolean;

  constructor(options: LoggerOptions = {}) {
    const {
      level,
      colorize,
      json,
      transports = [],
      timestampFormat,
      prefix,
      timestamp,
      context = {},
      parent,
      asyncMode,
      async,
      customLevels = {},
      customColors = {},
      filters = [],
      aggregators = [],
      enrichers,
      redact,
      queueProvider,
      queueOptions,
    } = options;

    super();
    this.context = { ...context }; // Init context
    this.customLevels = customLevels; // custom log store
    this.asyncMode = false;
    this.filters = [...filters]; // Copy filters
    this.aggregators = [...aggregators]; // Copy aggregators
    this.enrichers = enrichers ?? new LocalEnrichmentPipeline();
    this.retryOptions = options.retryOptions;
    this.redactor = redact ? new Redactor(redact) : undefined;
    this.queueProvider = queueProvider;

    if (parent) {
      if (parent.isClosed()) throw new Error("Cannot create a child of a closed logger");
      this.parentLogger = parent;
      this.level = level ?? parent.level;
      this.prefix = prefix ?? parent.prefix;
      this.timestamp = timestamp ?? parent.timestamp;
      this.asyncMode = (async ?? asyncMode) ?? parent.asyncMode;
      this.queueProvider = queueProvider ?? parent.queueProvider;
      this.transports =
        transports && transports.length > 0
          ? this.initTransports(
            transports,
          )
          : parent.transports;
      // Merge colors; child overrides parent
      const mergedCColors = {
        ...parent.formatter.getCustomColors(),
        ...customColors,
      };
      this.formatter = new Formatter({
        colorize:
          colorize ?? parent.formatter.isColorized(),
        json: json ?? parent.formatter.isJson(),
        timestampFormat:
          timestampFormat ?? parent.formatter.getTimestampFormat(),
        timestamp: timestamp ?? parent.formatter.hasTimestamp(),
        customColors: mergedCColors,
      });
      this.context = { ...parent.context, ...this.context };
      // Merge custom levels with parent's custom levels
      this.customLevels = { ...parent.customLevels, ...customLevels };
      // Merge filters with parent's filters
      this.filters = [...parent.filters, ...filters];
      // Merge aggregators with parent's aggregators
      this.aggregators = [...parent.aggregators, ...aggregators];
      // If child logger doesn't provide its own enrichers, use parent's
      // If child logger provides enrichers, merge parent and child enrichers
      if (enrichers) {
        // Create a new pipeline that combines parent and child enrichers
        const parentEnrichers = parent.enrichers.getEnrichers();
        const childEnrichers = enrichers.getEnrichers();
        this.enrichers = new LocalEnrichmentPipeline([...parentEnrichers, ...childEnrichers]);
      } else {
        this.enrichers = parent.enrichers;
      }
      // Child inherits parent's redactor unless the child provides its own redact config
      this.redactor = redact ? new Redactor(redact) : parent.redactor;
    } else {
      // Auto-configure based on environment
      const isProd = this.isProductionEnvironment();

      this.level = level ?? this.getDefaultLevel(isProd);
      this.prefix = prefix ?? "";
      this.timestamp = timestamp ?? this.getDefaultTimestamp(isProd);

      const defaultTransports =
        transports && transports.length > 0
          ? transports
          : this.getDefaultTransports(isProd);

      this.asyncMode = (async ?? asyncMode) ?? this.getDefaultAsyncMode(isProd);

      this.transports = this.initTransports(
        defaultTransports,
      );

      this.formatter = new Formatter({
        colorize: this.getDefaultColorizeValue(colorize),
        json: json ?? this.getDefaultJson(isProd),
        timestampFormat: timestampFormat ?? "YYYY-MM-DD HH:mm:ss",
        timestamp: this.timestamp,
        customColors,
      });
    }

    if (this.asyncMode && !this.queueProvider) {
      this.queueProvider = queueProvider ?? this.getOrCreateQueueProvider(queueOptions);
    }

    this._contextKeys = Object.keys(this.context).length;
    this._hasEnrichers = this.enrichers.getEnrichers().length > 0;
    this.refreshProcessingFlag();
    this.levelPriority = this.getLevelPriority(this.level);

    if (!Logger._global) {
      Logger._global = this;
    }

    this._bindLevelMethods();
    // Ordinary request children share resources and must not be retained by the
    // parent forever. Track only children whose own resources need shutdown.
    this.ownsResources = !parent ||
      this.queueProvider !== parent.queueProvider ||
      this.transports.some((transport) => !parent.transports.includes(transport)) ||
      this.aggregators.some((aggregator) => !parent.aggregators.includes(aggregator));
    if (this.ownsResources) parent?.retainChild(this);
  }

  private retainChild(child: Logger): void {
    this.children.add(child);
    this.parentLogger?.retainChild(this);
  }

  private releaseChild(child: Logger): void {
    this.children.delete(child);
    if (!this.children.size && !this.ownsResources) this.parentLogger?.releaseChild(this);
  }

  private isProductionEnvironment(): boolean {
    const env = process.env.NODE_ENV?.toLowerCase();
    return env === "production" || env === "prod";
  }

  private getDefaultLevel(isProd: boolean): LogLevel {
    return isProd ? "warn" : "debug";
  }

  private getDefaultColorizeValue(colorize: boolean | undefined): boolean {
    if (colorize !== undefined) {
      return colorize;
    }
    const isProd = this.isProductionEnvironment();
    return !isProd;
  }

  private getDefaultJson(isProd: boolean): boolean {
    return isProd;
  }

  private getDefaultTimestamp(_isProd: boolean): boolean {
    return true;
  }

  private getDefaultTransports(isProd: boolean): TransportConfig[] {
    if (Logger.defaultTransportsFactory) {
      return Logger.defaultTransportsFactory(isProd);
    }
    return [new SimpleConsoleTransport()];
  }

  private getDefaultAsyncMode(isProd: boolean): boolean {
    return isProd;
  }

  private initTransports(
    transportConfigs: TransportConfig[],
  ): Transport[] {
    const initializedTransports: Transport[] = [];
    const retryFactory = Logger.retryTransportFactory;

    for (const transportConfig of transportConfigs) {
      if (this.isTransport(transportConfig)) {
        let transport = transportConfig as Transport;

        if (this.retryOptions && retryFactory && !this.isRetryWrappedTransport(transport)) {
          transport = retryFactory({
            ...this.retryOptions,
            wrappedTransport: transport,
          });
        }

        initializedTransports.push(transport);
      }
    }
    return initializedTransports;
  }

  private getOrCreateQueueProvider(options?: MemoryQueueOptions): QueueProvider {
    if (this.queueProvider) {
      return this.queueProvider;
    }
    if (Logger.defaultQueueProviderFactory) {
      this.queueProvider = Logger.defaultQueueProviderFactory(options);
      return this.queueProvider;
    }
    throw new Error(
      "Async mode is enabled but no queue provider was provided, and Logger.defaultQueueProviderFactory is not configured. " +
      "If you are using the lightweight entry point 'zario/logger', you must configure a queue provider or import the full 'zario' package."
    );
  }

  private isTransport(transport: any): transport is Transport {
    return (
      typeof transport === "object" &&
      transport !== null &&
      typeof (transport as any).write === "function"
    );
  }

  private isRetryWrappedTransport(transport: Transport): boolean {
    const candidate = transport as RetryWrappedTransport;
    return candidate.__zarioRetryTransport === true;
  }



  private shouldLog(level: LogLevel): boolean {
    const messageLevelPriority = this.getLevelPriority(level);
    return messageLevelPriority >= this.levelPriority;
  }

  private refreshProcessingFlag(): void {
    this._requiresProcessing =
      this._contextKeys > 0 ||
      this.filters.length > 0 ||
      this._hasEnrichers ||
      this.aggregators.length > 0 ||
      this.redactor !== undefined;
  }

  private hasOwnKeys(metadata: Record<string, any>): boolean {
    for (const key in metadata) {
      if (Object.prototype.hasOwnProperty.call(metadata, key)) {
        return true;
      }
    }
    return false;
  }

  private getLevelPriority(level: LogLevel): number {
    switch (level) {
      case "silent": return Number.POSITIVE_INFINITY;
      case "boring": return 1;
      case "debug": return 2;
      case "info": return 3;
      case "warn": return 4;
      case "error": return 5;
      case "fatal": return 6;
      default:
        if (this.customLevels && level in this.customLevels) {
          return this.customLevels[level] ?? 999;
        }
        return 999;
    }
  }

  private _bindLevelMethods(): void {
    for (let priority = 0; priority < LEVEL_METHODS.length; priority++) {
      const name = LEVEL_METHODS[priority]!;
      if (name !== "silent" && priority >= this.levelPriority) {
        (this as any)[name] = this.logEnabled.bind(this, name);
      } else {
        (this as any)[name] = NOOP;
      }
    }
  }

  private log(
    level: LogLevel,
    message: LogInput,
    metadata?: LogDetails,
  ): void {
    if (level === "silent" || !this.shouldLog(level)) {
      return;
    }

    this.logEnabled(level, message, metadata);
  }

  private logEnabled(
    level: LogLevel,
    input: LogInput,
    details?: LogDetails,
  ): void {
    if (this.closed || this.parentLogger?.isClosed()) return;
    const message = typeof input === "string"
      ? input
      : typeof details === "string" ? details : input instanceof Error ? input.message : "";
    const metadata = typeof input === "string"
      ? details instanceof Error ? { err: details } : typeof details === "object" ? details : undefined
      : input instanceof Error
        ? { ...(typeof details === "object" && !(details instanceof Error) ? details : {}), err: input }
        : input;

    // Fast path: no context, filters, enrichers, aggregators, or redactor.
    // Empty metadata retains the existing behavior of being omitted.
    if (!this._requiresProcessing) {
      const finalMetadata =
        metadata !== undefined && this.hasOwnKeys(metadata) ? metadata : undefined;
      const timestamp = new Date();
      const logData: LogData = { level, message, timestamp, metadata: finalMetadata, prefix: this.prefix };
      const transports = this.transports;
      if (this.asyncMode) {
        this.queueProvider!.enqueue(logData, this.formatter, transports);
      } else {
        for (let i = 0; i < transports.length; i++) {
          transports[i]!.write(logData, this.formatter);
        }
      }
      return;
    }

    const hasMetadata = metadata !== undefined && this.hasOwnKeys(metadata);

    let finalMetadata: Record<string, any> | undefined;
    if (this._contextKeys > 0) {
      if (hasMetadata) {
        finalMetadata = Object.assign({}, this.context, metadata);
      } else {
        finalMetadata = this.context;
      }
    } else if (hasMetadata) {
      finalMetadata = metadata;
    }

    if (finalMetadata !== undefined && this.redactor) {
      finalMetadata = this.redactor.redact(finalMetadata) as Record<string, any>;
    }

    const timestamp = new Date();

    const logData: LogData = {
      level,
      message,
      timestamp,
      metadata: finalMetadata,
      prefix: this.prefix,
    };

    const filters = this.filters;
    const filterCount = filters.length;
    if (filterCount > 0) {
      for (let i = 0; i < filterCount; i++) {
        const filter = filters[i];
        if (filter && !filter.shouldEmit(logData)) {
          return;
        }
      }
    }

    let enrichedData = logData;
    if (this._hasEnrichers) {
      try {
        enrichedData = this.enrichers.process(logData);
      } catch (error) {
        console.error('Error in enrichers:', error);
        if (this.listenerCount('error') > 0) {
          this.emit('error', { type: 'enricher', error });
        }
      }
    }

    const transports = this.transports;
    const transportCount = transports.length;
    
    if (this.asyncMode) {
      this.queueProvider!.enqueue(enrichedData, this.formatter, transports);
    } else {
      for (let i = 0; i < transportCount; i++) {
        transports[i]!.write(enrichedData, this.formatter);
      }
    }

    const aggregators = this.aggregators;
    const aggregatorCount = aggregators.length;
    if (aggregatorCount > 0) {
      for (let i = 0; i < aggregatorCount; i++) {
        const aggregator = aggregators[i];
        if (aggregator) {
          try {
            aggregator.aggregate(enrichedData, this.formatter);
          } catch (error) {
            console.error('Error in aggregator:', error);
            if (this.listenerCount('error') > 0) {
              this.emit('error', { type: 'aggregator', error });
            }
          }
        }
      }
    }
  }

  /** Log a message, structured fields, or an Error with diagnostic details. */
  debug(message: string, metadata?: Record<string, unknown> | Error): void;
  debug(error: Error, messageOrMetadata?: string | Record<string, unknown>): void;
  debug(metadata: Record<string, unknown>, message?: string): void;
  debug(message: LogInput, metadata?: LogDetails): void {
    this.log("debug", message, metadata);
  }

  /** Log a message, structured fields, or an Error with diagnostic details. */
  info(message: string, metadata?: Record<string, unknown> | Error): void;
  info(error: Error, messageOrMetadata?: string | Record<string, unknown>): void;
  info(metadata: Record<string, unknown>, message?: string): void;
  info(message: LogInput, metadata?: LogDetails): void {
    this.log("info", message, metadata);
  }

  /** Log a message, structured fields, or an Error with diagnostic details. */
  warn(message: string, metadata?: Record<string, unknown> | Error): void;
  warn(error: Error, messageOrMetadata?: string | Record<string, unknown>): void;
  warn(metadata: Record<string, unknown>, message?: string): void;
  warn(message: LogInput, metadata?: LogDetails): void {
    this.log("warn", message, metadata);
  }

  /** Log a message, structured fields, or an Error with diagnostic details. */
  error(message: string, metadata?: Record<string, unknown> | Error): void;
  error(error: Error, messageOrMetadata?: string | Record<string, unknown>): void;
  error(metadata: Record<string, unknown>, message?: string): void;
  error(message: LogInput, metadata?: LogDetails): void {
    this.log("error", message, metadata);
  }

  /** Log a message, structured fields, or an Error with diagnostic details. */
  fatal(message: string, metadata?: Record<string, unknown> | Error): void;
  fatal(error: Error, messageOrMetadata?: string | Record<string, unknown>): void;
  fatal(metadata: Record<string, unknown>, message?: string): void;
  fatal(message: LogInput, metadata?: LogDetails): void {
    this.log("fatal", message, metadata);
  }

  /** Log a message, structured fields, or an Error with diagnostic details. */
  silent(message: string, metadata?: Record<string, unknown> | Error): void;
  silent(error: Error, messageOrMetadata?: string | Record<string, unknown>): void;
  silent(metadata: Record<string, unknown>, message?: string): void;
  silent(message: LogInput, metadata?: LogDetails): void {
    this.log("silent", message, metadata);
  }

  /** Log a message, structured fields, or an Error with diagnostic details. */
  boring(message: string, metadata?: Record<string, unknown> | Error): void;
  boring(error: Error, messageOrMetadata?: string | Record<string, unknown>): void;
  boring(metadata: Record<string, unknown>, message?: string): void;
  boring(message: LogInput, metadata?: LogDetails): void {
    this.log("boring", message, metadata);
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
    this.log(level, message, metadata);
  }

  /** Return the configured threshold, for framework logger adapters. */
  getLevel(): LogLevel {
    return this.level;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
    this.levelPriority = this.getLevelPriority(level);
    this._bindLevelMethods();
  }

  setFormat(format: "text" | "json"): void {
    this.formatter.setJson(format === "json");
  }

  setAsyncMode(asyncMode: boolean): void {
    this.asyncMode = asyncMode;
    if (asyncMode && !this.queueProvider) {
      this.queueProvider = this.getOrCreateQueueProvider();
    } else if (!asyncMode && this.queueProvider) {
      this.queueProvider.destroy().catch((err) => {
        console.error("Error destroying queue provider:", err);
      });
      this.queueProvider = undefined;
    }
  }

  addTransport(transport: Transport): void {
    this.transports.push(transport);
  }

  getTimestampSetting(): boolean {
    return this.timestamp;
  }

  static get global(): Logger {
    if (!Logger._global) {
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
    return !this.isClosed() && level !== "silent" && this.shouldLog(level);
  }

  /** Whether this logger or its parent has started closing. */
  isClosed(): boolean {
    return this.closed || (this.parentLogger?.isClosed() ?? false);
  }

  /** Wait for queued logs, aggregators and transport buffers to finish. */
  async flush(): Promise<void> {
    const results = await Promise.allSettled([this.flushAggregators()]);
    results.push(...await Promise.allSettled(
      [...new Set(this.transports)].map(async (transport) => { await transport.flush?.(); }),
    ));
    const failure = results.find((result) => result.status === "rejected");
    if (failure?.status === "rejected") throw failure.reason;
  }

  /**
   * Stop accepting logs, drain pending work and release owned resources.
   * Repeated calls share one promise. Children do not close inherited resources.
   */
  close(): Promise<void> {
    if (this.closePromise) return this.closePromise;
    this.closed = true;
    this.closePromise = this.closeResources();
    return this.closePromise;
  }

  private async closeResources(): Promise<void> {
    const failures: unknown[] = [];
    const attempt = async (action: () => void | Promise<void>): Promise<void> => {
      try { await action(); } catch (error) { failures.push(error); }
    };
    await Promise.all([...this.children].map((child) => attempt(() => child.close())));
    await attempt(() => this.flush());
    if (this.queueProvider && this.queueProvider !== this.parentLogger?.queueProvider) {
      await attempt(() => this.queueProvider!.destroy());
    }
    for (const transport of new Set(this.transports)) {
      if (this.parentLogger?.transports.includes(transport)) continue;
      await attempt(() => transport.close ? transport.close() : transport.destroy?.());
    }
    this.parentLogger?.releaseChild(this);
    if (failures.length) throw failures[0];
  }

  startTimer(name: string): Timer {
    return new Timer(name, (message: string) => this.info(message));
  }

  /**
   * Add a filter to the logger
   */
  addFilter(filter: Filter): void {
    this.filters.push(filter);
    this.refreshProcessingFlag();
  }

  /**
   * Remove a filter from the logger
   */
  removeFilter(filter: Filter): boolean {
    const index = this.filters.indexOf(filter);
    if (index !== -1) {
      this.filters.splice(index, 1);
      this.refreshProcessingFlag();
      return true;
    }
    return false;
  }

  /**
   * Add an aggregator to the logger
   */
  addAggregator(aggregator: LogAggregator): void {
    this.aggregators.push(aggregator);
    this.refreshProcessingFlag();
  }

  /**
   * Remove an aggregator from the logger
   */
  removeAggregator(aggregator: LogAggregator): boolean {
    const index = this.aggregators.indexOf(aggregator);
    if (index !== -1) {
      this.aggregators.splice(index, 1);
      this.refreshProcessingFlag();
      return true;
    }
    return false;
  }

  addEnricher(enricher: LogEnricher): void {
    this.enrichers.add(enricher);
    this._hasEnrichers = true;
    this.refreshProcessingFlag();
  }

  /**
   * Flush all aggregators
   */
  async flushAggregators(): Promise<void> {
    const actions: Array<() => void | Promise<void>> = [];
    if (this.queueProvider) actions.push(() => this.queueProvider!.flush());
    for (const aggregator of this.aggregators) actions.push(() => aggregator.flush());
    const results = await Promise.allSettled(actions.map(async (action) => { await action(); }));
    const failure = results.find((result) => result.status === "rejected");
    if (failure?.status === "rejected") throw failure.reason;
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
    level: options.level ?? "info",
    async: options.async ?? options.asyncMode ?? false,
    transports: options.transports?.length ? options.transports : [new SimpleConsoleTransport()],
  });
}
