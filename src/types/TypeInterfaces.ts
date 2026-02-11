export interface LoggerMetadata {
  [key: string]: unknown;
}

export interface ErrorEvent {
  type: string;
  error: Error;
}
