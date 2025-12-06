import { ConsoleTransport, ConsoleTransportOptions } from "./ConsoleTransport";
import { FileTransport, FileTransportOptions } from "./FileTransport";
import { HttpTransport, HttpTransportOptions } from "./HttpTransport";

export * from "./Transport";
export * from "./ConsoleTransport";
export * from "./FileTransport";
export * from "./HttpTransport";

// Transport factory functions for easier API use
export function consoleT(options?: ConsoleTransportOptions): ConsoleTransport {
  return new ConsoleTransport(options);
}

export function fileT(options: FileTransportOptions): FileTransport {
  return new FileTransport(options);
}

export function httpT(options: HttpTransportOptions): HttpTransport {
  return new HttpTransport(options);
}
