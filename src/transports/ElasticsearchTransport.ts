import { serialize } from "../utils/serialize.js";
import { Transport } from "./Transport.js";
import { LogData } from "../types/index.js";
import { Formatter } from "../core/Formatter.js";

export interface ElasticsearchTransportOptions {
  /** Cluster URL, for example `"http://localhost:9200"`. Works with Elasticsearch and OpenSearch. */
  node: string;
  /** Target index or data stream, or a function that picks one per record. Default: `"logs-zario"` */
  index?: string | ((data: LogData) => string);
  /** Use the `create` action, which data streams require. Default: `false` */
  dataStream?: boolean;
  /** Elasticsearch API key (sent as `Authorization: ApiKey <key>`). */
  apiKey?: string;
  /** Basic auth. */
  username?: string;
  password?: string;
  /** Extra request headers. */
  headers?: Record<string, string>;
  /** Ingest pipeline for every document. */
  pipeline?: string;
  /** Records per bulk request. Default: `500` */
  batchSize?: number;
  /** Maximum time (ms) a record waits before a bulk request. Default: `2000` */
  flushInterval?: number;
  /** Records kept in memory. The oldest is dropped first. Default: `10000` */
  maxQueueSize?: number;
  /** Retries for a failed request, and for items rejected with 429. Default: `3` */
  maxRetries?: number;
  /** First retry delay (ms). It doubles after each retry. Default: `500` */
  retryDelay?: number;
  /** Request timeout (ms). Default: `10000` */
  timeout?: number;
}

interface BulkItemResult {
  status: number;
  error?: { type?: string; reason?: string };
}

const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);

export class ElasticsearchTransport implements Transport {
  private readonly bulkUrl: string;
  private readonly index: (data: LogData) => string;
  private readonly action: "index" | "create";
  private readonly headers: Record<string, string>;
  private readonly batchSize: number;
  private readonly flushInterval: number;
  private readonly maxQueueSize: number;
  private readonly maxRetries: number;
  private readonly retryDelay: number;
  private readonly timeout: number;
  private buffer: Array<{ action: string; doc: string }> = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private sending: Promise<void> = Promise.resolve();
  private inFlight = 0;
  private failure: { error: unknown } | undefined;
  private dropped = 0;
  private closed = false;

  constructor(options: ElasticsearchTransportOptions) {
    const {
      node,
      index = "logs-zario",
      dataStream = false,
      apiKey,
      username,
      password,
      headers = {},
      pipeline,
      batchSize = 500,
      flushInterval = 2000,
      maxQueueSize = 10000,
      maxRetries = 3,
      retryDelay = 500,
      timeout = 10000,
    } = options;
    if (!node) throw new Error("ElasticsearchTransport requires a node option");

    const url = new URL("_bulk", node.endsWith("/") ? node : `${node}/`);
    if (pipeline) url.searchParams.set("pipeline", pipeline);
    this.bulkUrl = url.toString();
    this.index = typeof index === "function" ? index : () => index;
    this.action = dataStream ? "create" : "index";
    this.headers = { "Content-Type": "application/x-ndjson", ...headers };
    if (apiKey) this.headers.Authorization = `ApiKey ${apiKey}`;
    else if (username !== undefined) {
      this.headers.Authorization = `Basic ${Buffer.from(`${username}:${password ?? ""}`).toString("base64")}`;
    }
    this.batchSize = batchSize;
    this.flushInterval = flushInterval;
    this.maxQueueSize = maxQueueSize;
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
    this.timeout = timeout;
  }

  /** The document stored for one record. */
  toDocument(data: LogData): Record<string, unknown> {
    const doc: Record<string, unknown> = {
      "@timestamp": data.timestamp.toISOString(),
      level: data.level,
      message: data.message,
    };
    if (data.prefix) doc.prefix = data.prefix;
    if (data.metadata) doc.metadata = data.metadata;
    return doc;
  }

  write(data: LogData, _formatter: Formatter): void {
    if (this.closed) return;
    this.buffer.push({
      action: serialize({ [this.action]: { _index: this.index(data) } }),
      doc: serialize(this.toDocument(data)),
    });
    // An unreachable cluster must not make memory grow without a limit.
    if (this.buffer.length > this.maxQueueSize) {
      this.buffer.shift();
      if (this.dropped++ === 0) console.error("ElasticsearchTransport: the queue is full, so the oldest records are dropped");
    }
    if (this.buffer.length >= this.batchSize) this.sendBuffered();
    else this.timer ??= setTimeout(() => {
      this.timer = undefined;
      this.sendBuffered();
    }, this.flushInterval);
  }

  async writeAsync(data: LogData, formatter: Formatter): Promise<void> {
    this.write(data, formatter);
  }

  /** Records dropped because the queue was full. */
  getDroppedCount(): number {
    return this.dropped;
  }

  /** Send all buffered records, wait for every bulk request, and report the first failure. */
  async flush(): Promise<void> {
    while (this.buffer.length > 0 || this.inFlight > 0) {
      this.sendBuffered();
      await this.sending;
    }
    if (this.failure) {
      const { error } = this.failure;
      this.failure = undefined;
      throw error;
    }
  }

  async close(): Promise<void> {
    try {
      await this.flush();
    } finally {
      this.closed = true;
      if (this.timer) clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  // One bulk request at a time keeps the order and does not overload the cluster.
  private sendBuffered(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    while (this.buffer.length > 0) {
      const batch = this.buffer.splice(0, this.batchSize);
      this.inFlight++;
      this.sending = this.sending
        .then(() => this.sendBulk(batch, 0))
        .catch((error: unknown) => {
          this.failure ??= { error };
          console.error("ElasticsearchTransport error:", error instanceof Error ? error.message : String(error));
        })
        .finally(() => { this.inFlight--; });
    }
  }

  private async sendBulk(batch: Array<{ action: string; doc: string }>, attempt: number): Promise<void> {
    const body = batch.map((item) => `${item.action}\n${item.doc}\n`).join("");
    let response: Response;
    try {
      response = await fetch(this.bulkUrl, {
        method: "POST",
        headers: this.headers,
        body,
        signal: AbortSignal.timeout(this.timeout),
      });
    } catch (error) {
      if (attempt < this.maxRetries) return this.retry(batch, attempt);
      throw error;
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      if (RETRYABLE_STATUS.has(response.status) && attempt < this.maxRetries) return this.retry(batch, attempt);
      throw new Error(`Elasticsearch bulk request failed with status ${response.status}: ${text.slice(0, 500)}`);
    }

    const result = await response.json() as { errors?: boolean; items?: Array<Record<string, BulkItemResult>> };
    if (!result.errors) return;

    // Retry the items that the cluster rejected with 429. Other item errors, for example
    // mapping conflicts, fail the same way again, so report them.
    const retry: typeof batch = [];
    let firstError: BulkItemResult["error"];
    result.items?.forEach((item, i) => {
      const outcome = Object.values(item)[0];
      if (!outcome || outcome.status < 300) return;
      if (outcome.status === 429) retry.push(batch[i]!);
      else firstError ??= outcome.error ?? { reason: `status ${outcome.status}` };
    });
    if (retry.length > 0) {
      if (attempt < this.maxRetries) await this.retry(retry, attempt);
      else firstError ??= { reason: `${retry.length} items were still rejected with 429` };
    }
    if (firstError) {
      throw new Error(`Elasticsearch rejected documents: ${firstError.type ?? "error"}: ${firstError.reason ?? "unknown"}`);
    }
  }

  private async retry(batch: Array<{ action: string; doc: string }>, attempt: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, this.retryDelay * 2 ** attempt));
    return this.sendBulk(batch, attempt + 1);
  }
}
