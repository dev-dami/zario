import { Logger } from './core/Logger';
import { LogLevel } from './core/LogLevel';
import { ConsoleTransport } from './transports/ConsoleTransport';
import { FileTransport } from './transports/FileTransport';
import { Transport } from './transports/Transport';
import { TransportOptions, LoggerConfig } from './types/index';

export { Logger, ConsoleTransport, FileTransport };
export type { LogLevel, Transport, TransportOptions, LoggerConfig };
export default Logger;
