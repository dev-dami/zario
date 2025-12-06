import { Logger } from './core/Logger';
import { LogLevel } from './core/LogLevel';
import { ConsoleTransport, FileTransport, HttpTransport, Transport, consoleT, fileT, httpT } from './transports';
import { TransportConfig, LoggerConfig } from './types/index';
import { CustomLogLevelConfig } from './core/CustomLogLevel';

export { Logger, ConsoleTransport, FileTransport, HttpTransport, consoleT, fileT, httpT };
export type { LogLevel, Transport, TransportConfig, LoggerConfig, CustomLogLevelConfig };
export default Logger;
