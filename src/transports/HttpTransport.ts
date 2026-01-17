import { Transport } from "./Transport.js";
import { LogData } from "../types/index.js";
import { Formatter } from "../core/Formatter.js";
import * as http from "http";
import * as https from "https";
import * as url from "url";

export interface HttpTransportOptions {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  forceAsync?: boolean; // Force async mode even in write() method
}

export class HttpTransport implements Transport {
  private readonly urlString: string;
  private readonly parsedUrl: url.URL;
  private readonly isHttps: boolean;
  private readonly client: typeof http | typeof https;
  private readonly method: string;
  private readonly headers: Record<string, string>;
  private readonly timeout: number;
  private readonly retries: number;
  private readonly forceAsync: boolean;
  private readonly baseRequestOptions: http.RequestOptions;

  constructor(options: HttpTransportOptions) {
    const {
      url: urlOption,
      method = 'POST',
      headers = {},
      timeout = 5000,
      retries = 3,
      forceAsync = false
    } = options;

    if (!urlOption) {
      throw new Error('HttpTransport requires a URL option');
    }

    this.urlString = urlOption;
    this.parsedUrl = new url.URL(urlOption);
    this.isHttps = this.parsedUrl.protocol === 'https:';
    this.client = this.isHttps ? https : http;
    this.method = method.toUpperCase();
    this.headers = { ...headers };
    this.timeout = timeout;
    this.retries = retries;
    this.forceAsync = forceAsync;

    if (!this.headers['Content-Type'] && !this.headers['content-type']) {
      this.headers['Content-Type'] = 'application/json';
    }

    this.baseRequestOptions = {
      hostname: this.parsedUrl.hostname,
      port: this.parsedUrl.port,
      path: this.parsedUrl.pathname + this.parsedUrl.search,
      method: this.method,
      timeout: this.timeout,
    };
  }

  write(data: LogData, formatter: Formatter): void {
    // Format the data as JSON for HTTP transport
    const logObject = this.parseFormattedData(data);
    const body = JSON.stringify(logObject);

    if (this.forceAsync) {
      // Force async mode using setImmediate
      setImmediate(() => {
        this.sendHttpRequestWithRetry(body, 0)
          .catch((error) => {
            console.error('HttpTransport error (forced async mode):', (error as Error).message);
          });
      });
    } else {
      // Best-effort synchronous mode - note: actual network I/O is still async
      this.sendHttpRequestWithRetry(body, 0)
        .catch((error) => {
          console.error('HttpTransport error (sync mode):', (error as Error).message);
        });
    }
  }

  async writeAsync(data: LogData, formatter: Formatter): Promise<void> {
    // json formating for HttpTransport
    const logObject = this.parseFormattedData(data);
    const body = JSON.stringify(logObject);

    await this.sendHttpRequestWithRetry(body, this.retries);
  }

  private parseFormattedData(originalData: LogData): Record<string, unknown> {
    const result: Record<string, unknown> = {
      level: originalData.level,
      message: originalData.message,
      timestamp: originalData.timestamp.toISOString(),
    };
    if (originalData.prefix) {
      result.prefix = originalData.prefix;
    }
    if (originalData.metadata) {
      result.metadata = originalData.metadata;
    }
    return result;
  }

  private async sendHttpRequestWithRetry(body: string, maxRetries: number): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await this.sendHttpRequest(body);
        return; // success then exit
      } catch (error) {
        lastError = error as Error;

        // stop if last attempt
        if (attempt === maxRetries) {
          break;
        }

        // timer wait before continue
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }

    if (lastError) {
      throw lastError;
    }
  }

  private sendHttpRequest(body: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const requestOptions: http.RequestOptions = {
        ...this.baseRequestOptions,
        headers: {
          ...this.headers,
          'Content-Length': Buffer.byteLength(body, 'utf8'),
        },
      };

      const req = this.client.request(requestOptions, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`HTTP request failed with status ${res.statusCode}: ${responseData}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(body);
      req.end();
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}