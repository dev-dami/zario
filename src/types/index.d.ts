import { LogLevel } from '../core/LogLevel';

export interface TransportOptions {
  type: 'console' | 'file';
  options?: {
    path?: string;
    colorize?: boolean;
    maxSize?: number;
    maxFiles?: number;
  };
}

export interface LoggerConfig {
  level?: LogLevel;
  colorize?: boolean;
  json?: boolean;
  transports?: TransportOptions[];
  timestampFormat?: string;
}