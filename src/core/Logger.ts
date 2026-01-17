import { LogLevel } from "./LogLevel.js";
import { Formatter } from "./Formatter.js";
import { Transport } from "../transports/Transport.js";
import { ConsoleTransport } from "../transports/ConsoleTransport.js";
import { RetryTransport, RetryTransportOptions } from "../transports/RetryTransport.js";
import { TransportConfig, LogData } from "../types/index.js";
import { Filter } from "../filters/Filter.js";
import { LogAggregator } from "../aggregation/LogAggregator.js";
import { LogEnricher, LogEnrichmentPipeline } from "../structured/StructuredExtensions.js";
import { Timer } from "../utils/index.js";
import { EventEmitter } from "events";

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
  retryOptions?: RetryTransportOptions;
}

export class Logger extends EventEmitter {
  private level: LogLevel;
  private transports: Transport[];
  private formatter: Formatter;
  private context: Record<string, unknown>;
  private _contextKeys: number = 0;
  private _hasEnrichers: boolean = false;
  private parent: Logger | undefined;
  private asyncMode: boolean;
  private customLevels: { [level: string]: number };
  private filters: Filter[];
  private aggregators: LogAggregator[];
  private enrichers: LogEnrichmentPipeline;
  private deadLetterQueue?: any;
  private retryOptions: RetryTransportOptions | undefined;
  private static _global: Logger;
  public static defaultTransportsFactory: ((isProd: boolean) => TransportConfig[]) | null = null;
  private static readonly LEVEL_PRIORITIES: { [level: string]: number } = {
    silent: 0,
    boring: 1,
    debug: 2,
    info: 3,
    warn: 4,
    error: 5,
  };

  public prefix: string;
  public timestamp: boolean;

  constructor(options: LoggerOptions = {}) {
    const {
      level,
      colorize,
      json,
      transports = [],
      timestampFormat = "YYYY-MM-DD HH:mm:ss",
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
    } = options;

    super();
    this.parent = parent;
    this.context = { ...context }; // Init context
    this.customLevels = customLevels; // custom log store
    this.asyncMode = false;
    this.filters = [...filters]; // Copy filters
    this.aggregators = [...aggregators]; // Copy aggregators
    this.enrichers = enrichers ?? new LogEnrichmentPipeline();
    this.deadLetterQueue = options.deadLetterQueue;
    this.retryOptions = options.retryOptions;

    if (this.parent) {
      this.level = level ?? this.parent.level;
      this.prefix = prefix ?? this.parent.prefix;
      this.timestamp = timestamp ?? this.parent.timestamp;
      this.asyncMode = (async ?? asyncMode) ?? this.parent.asyncMode;
      this.transports =
        transports && transports.length > 0
          ? this.initTransports(
            transports,
          )
          : this.parent.transports;
      // Merge colors; child overrides parent
      const mergedCColors = {
        ...this.parent.formatter.getCustomColors(),
        ...customColors,
      };
      this.formatter = new Formatter({
        colorize:
          this.getDefaultColorizeValue(colorize) ??
          this.parent.formatter.isColorized(),
        json: json ?? this.parent.formatter.isJson(),
        timestampFormat:
          timestampFormat ?? this.parent.formatter.getTimestampFormat(),
        timestamp: timestamp ?? this.parent.formatter.hasTimestamp(),
        customColors: mergedCColors,
      });
      this.context = { ...this.parent.context, ...this.context };
      // Merge custom levels with parent's custom levels
      this.customLevels = { ...this.parent.customLevels, ...customLevels };
      // Merge filters with parent's filters
      this.filters = [...this.parent.filters, ...filters];
      // Merge aggregators with parent's aggregators
      this.aggregators = [...this.parent.aggregators, ...aggregators];
      // If child logger doesn't provide its own enrichers, use parent's
      // If child logger provides enrichers, merge parent and child enrichers
      if (enrichers) {
        // Create a new pipeline that combines parent and child enrichers
        const parentEnrichers = this.parent.enrichers.getEnrichers();
        const childEnrichers = enrichers.getEnrichers();
        this.enrichers = new LogEnrichmentPipeline([...parentEnrichers, ...childEnrichers]);
      } else {
        this.enrichers = this.parent.enrichers;
      }
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
        timestampFormat,
        timestamp: this.getDefaultTimestamp(isProd),
        customColors,
      });
    }

    this._contextKeys = Object.keys(this.context).length;
    this._hasEnrichers = this.enrichers.getEnrichers().length > 0;

    if (!Logger._global) {
      Logger._global = this;
    }
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

  private getDefaultTimestamp(isProd: boolean): boolean {
    return true;
  }

  private getDefaultTransports(isProd: boolean): TransportConfig[] {
    if (Logger.defaultTransportsFactory) {
      return Logger.defaultTransportsFactory(isProd);
    }
    return [new ConsoleTransport()];
  }

  private getDefaultAsyncMode(isProd: boolean): boolean {
    return isProd;
  }

  private initTransports(
    transportConfigs: TransportConfig[],
  ): Transport[] {
    const initializedTransports: Transport[] = [];
    for (const transportConfig of transportConfigs) {
      if (this.isTransport(transportConfig)) {
        let transport = transportConfig as Transport;
        
        // Check if transport is already a RetryTransport to avoid double-wrapping
        if (this.retryOptions && !(transport instanceof RetryTransport)) {
          transport = new RetryTransport({
            ...this.retryOptions,
            wrappedTransport: transport
          });
        }
        
        initializedTransports.push(transport);
      }
    }
    return initializedTransports;
  }

  private isTransport(transport: any): transport is Transport {
    return (
      typeof transport === "object" &&
      transport !== null &&
      typeof (transport as any).write === "function"
    );
  }



  private shouldLog(level: LogLevel): boolean {
    // Get the priority of the current logger level
    const currentLevelPriority = this.getLevelPriority(this.level);
    // Get the priority of the message level
    const messageLevelPriority = this.getLevelPriority(level);

    return messageLevelPriority >= currentLevelPriority;
  }

  private getLevelPriority(level: LogLevel): number {
    // use a static map to avoid repeated allocations
    if (Logger.LEVEL_PRIORITIES.hasOwnProperty(level)) {
      return Logger.LEVEL_PRIORITIES[level]!;
    }
    // Check if it's a custom level
    if (this.customLevels && level in this.customLevels) {
      const customPriority = this.customLevels[level];
      return customPriority !== undefined ? customPriority : 999;
    }
    return 999;
  }

  private log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>,
  ): void {
    if (level === "silent" || !this.shouldLog(level)) {
      return;
    }

    const timestamp = new Date();

    let finalMetadata: Record<string, any> | undefined;
    const contextKeys = this._contextKeys;
    const metadataKeys = metadata ? Object.keys(metadata).length : 0;
    
    if (contextKeys > 0 && metadataKeys > 0) {
      finalMetadata = Object.assign({}, this.context, metadata);
    } else if (contextKeys > 0) {
      finalMetadata = this.context as Record<string, any>;
    } else if (metadataKeys > 0) {
      finalMetadata = metadata;
    }

    const logData: LogData = {
      level,
      message,
      timestamp,
      metadata: finalMetadata,
      prefix: this.prefix,
    };

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

    const filters = this.filters;
    const filterCount = filters.length;
    if (filterCount > 0) {
      for (let i = 0; i < filterCount; i++) {
        const filter = filters[i];
        if (filter && !filter.shouldEmit(enrichedData)) {
          return;
        }
      }
    }

    const transports = this.transports;
    const transportCount = transports.length;
    
    if (this.asyncMode) {
      for (let i = 0; i < transportCount; i++) {
        const transport = transports[i];
        if (transport) {
          if (transport.writeAsync) {
            transport.writeAsync(enrichedData, this.formatter).catch((error) => {
              console.error("Error during async logging:", error);
              if (this.listenerCount('error') > 0) {
                this.emit('error', { type: 'transport', error });
              }
            });
          } else {
            setImmediate(() => {
              transport.write(enrichedData, this.formatter);
            });
          }
        }
      }
    } else {
      for (let i = 0; i < transportCount; i++) {
        const transport = transports[i];
        if (transport) {
          transport.write(enrichedData, this.formatter);
        }
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

  debug(message: string, metadata?: Record<string, any>): void {
    this.log("debug", message, metadata);
  }

  info(message: string, metadata?: Record<string, any>): void {
    this.log("info", message, metadata);
  }

  warn(message: string, metadata?: Record<string, any>): void {
    this.log("warn", message, metadata);
  }

  error(message: string, metadata?: Record<string, any>): void {
    this.log("error", message, metadata);
  }

  fatal(message: string, metadata?: Record<string, any>): void {
    this.log("fatal", message, metadata);
  }

  silent(message: string, metadata?: Record<string, any>): void {
    this.log("silent", message, metadata);
  }

  boring(message: string, metadata?: Record<string, any>): void {
    this.log("boring", message, metadata);
  }

  /**
   * Generic log method that allows logging with custom levels
   */
  logWithLevel(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>,
  ): void {
    this.log(level, message, metadata);
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setFormat(format: "text" | "json"): void {
    this.formatter.setJson(format === "json");
  }

  setAsyncMode(asyncMode: boolean): void {
    this.asyncMode = asyncMode;
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

  startTimer(name: string): Timer {
    return new Timer(name, (message: string) => this.info(message));
  }

  /**
   * Add a filter to the logger
   */
  addFilter(filter: Filter): void {
    this.filters.push(filter);
  }

  /**
   * Remove a filter from the logger
   */
  removeFilter(filter: Filter): boolean {
    const index = this.filters.indexOf(filter);
    if (index !== -1) {
      this.filters.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Add an aggregator to the logger
   */
  addAggregator(aggregator: LogAggregator): void {
    this.aggregators.push(aggregator);
  }

  /**
   * Remove an aggregator from the logger
   */
  removeAggregator(aggregator: LogAggregator): boolean {
    const index = this.aggregators.indexOf(aggregator);
    if (index !== -1) {
      this.aggregators.splice(index, 1);
      return true;
    }
    return false;
  }

  addEnricher(enricher: LogEnricher): void {
    this.enrichers.add(enricher);
    this._hasEnrichers = true;
  }

  /**
   * Flush all aggregators
   */
  async flushAggregators(): Promise<void> {
    const flushPromises: Promise<void>[] = [];
    for (const aggregator of this.aggregators) {
      const result = aggregator.flush();
      if (result instanceof Promise) {
        flushPromises.push(result);
      }
    }
    await Promise.all(flushPromises);
  }

  getTransports(): Transport[] {
    return this.transports;
  }
}
