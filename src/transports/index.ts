import { ConsoleTransport, ConsoleTransportOptions } from "./ConsoleTransport";
import { FileTransport, FileTransportOptions } from "./FileTransport";
import { HttpTransport, HttpTransportOptions } from "./HttpTransport";

export * from "./Transport";
export * from "./ConsoleTransport";
export * from "./FileTransport";
export * from "./HttpTransport";

/**
 * Create a ConsoleTransport instance configured with the given options.
 *
 * @param options - Configuration options for the console transport
 * @returns A `ConsoleTransport` instance
 */
export function consoleT(options?: ConsoleTransportOptions): ConsoleTransport {
  return new ConsoleTransport(options);
}

/**
 * Create a FileTransport configured with the provided options.
 *
 * @param options - Options to configure the FileTransport
 * @returns A new `FileTransport` instance configured according to `options`
 */
export function fileT(options: FileTransportOptions): FileTransport {
  return new FileTransport(options);
}

/**
 * Creates an HttpTransport using the provided configuration.
 *
 * @param options - Configuration options for the HttpTransport
 * @returns The constructed `HttpTransport` instance
 */
export function httpT(options: HttpTransportOptions): HttpTransport {
  return new HttpTransport(options);
}