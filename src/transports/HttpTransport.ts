import { Transport } from "./Transport";
import { LogData } from "../types";
import { Formatter } from "../core/Formatter";
import * as http from "http";
import * as https from "https";
import * as url from "url";

export interface HttpTransportOptions {
  url: string;                    // Required: remote endpoint URL
  method?: string;                // Optional: defaults to 'POST'
  headers?: Record<string, string>; // Optional: custom headers
  timeout?: number;               // Optional: request timeout in milliseconds, defaults to 5000
  retries?: number;               // Optional: number of retry attempts, defaults to 3
}

export class HttpTransport implements Transport {
  private url: string;
  private method: string;
  private headers: Record<string, string>;
  private timeout: number;
  private retries: number;

  constructor(options: HttpTransportOptions) {
    const {
      url,
      method = 'POST',
      headers = {},
      timeout = 5000,
      retries = 3
    } = options;

    if (!url) {
      throw new Error('HttpTransport requires a URL option');
    }

    this.url = url;
    this.method = method.toUpperCase();
    this.headers = { ...headers };
    this.timeout = timeout;
    this.retries = retries;

    // Set default Content-Type if not provided
    if (!this.headers['Content-Type'] && !this.headers['content-type']) {
      this.headers['Content-Type'] = 'application/json';
    }
  }

  write(data: LogData, formatter: Formatter): void {
    // Format the data as JSON for HTTP transport
    const formattedData = formatter.format(data);
    const logObject = this.parseFormattedData(formattedData, data);
    const body = JSON.stringify(logObject);

    // For synchronous operation, initiate the HTTP request without waiting
    // In Node.js, HTTP requests are inherently async, so we make it fire-and-forget
    setImmediate(() => {
      this.sendHttpRequestWithRetry(body, 0) // No retries in sync mode
        .catch((error) => {
          // In sync mode, we just log errors to console instead of throwing
          console.error('HttpTransport error (sync mode):', error.message);
        });
    });
  }

  async writeAsync(data: LogData, formatter: Formatter): Promise<void> {
    // Format the data as JSON for HTTP transport
    const formattedData = formatter.format(data);
    const logObject = this.parseFormattedData(formattedData, data);
    const body = JSON.stringify(logObject);

    await this.sendHttpRequestWithRetry(body, this.retries);
  }

  private parseFormattedData(formattedData: string, originalData: LogData): any {
    // Create a structured log object regardless of formatter output
    return {
      level: originalData.level,
      message: originalData.message,
      timestamp: originalData.timestamp.toISOString(),
      ...(originalData.prefix && { prefix: originalData.prefix }),
      ...(originalData.metadata && { metadata: originalData.metadata })
    };
  }

  private async sendHttpRequestWithRetry(body: string, maxRetries: number): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await this.sendHttpRequest(body);
        return; // Success, exit the loop
      } catch (error) {
        lastError = error as Error;

        // If this was the last attempt, stop retrying
        if (attempt === maxRetries) {
          break;
        }

        // Wait before retrying (exponential backoff)
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }

    if (lastError) {
      throw lastError;
    }
  }

  private sendHttpRequest(body: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new url.URL(this.url);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;
      
      const requestOptions: http.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method: this.method,
        headers: {
          ...this.headers,
          'Content-Length': Buffer.byteLength(body, 'utf8'),
        },
        timeout: this.timeout,
      };

      const req = client.request(requestOptions, (res) => {
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