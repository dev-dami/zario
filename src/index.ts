import { Logger } from './core/Logger.js';
import { LogLevel } from './core/LogLevel.js';
import { ConsoleTransport, FileTransport, HttpTransport, Transport } from './transports/index.js';
import { TransportConfig, LoggerConfig } from './types/index.js';
import { CustomLogLevelConfig } from './core/CustomLogLevel.js';

// Configure default transports to maintain backward compatibility
Logger.defaultTransportsFactory = (isProd: boolean) => {
  if (isProd) {
    return [new ConsoleTransport(), new FileTransport({ path: "./logs/app.log" })];
  } else {
    return [new ConsoleTransport()];
  }
};

export { Logger, ConsoleTransport, FileTransport, HttpTransport };
export type { LogLevel, Transport, TransportConfig, LoggerConfig, CustomLogLevelConfig };
export default Logger;
