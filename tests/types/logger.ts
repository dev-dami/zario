import { zario, type Logger } from '../../src/index.js';
import { zario as leanZario } from '../../src/logger.js';

/** Compile-only consumer contract, including rejected argument combinations. */
export function verifyApi(): void {
  const log: Logger = zario();
  leanZario().info('ready');
  log.info('saved', { id: 1 });
  log.info({ id: 1 }, 'saved');
  log.info({ id: 1 });
  log.error(new Error('failed'));
  log.error(new Error('failed'), { id: 1 });
  log.error(new Error('failed'), 'save failed');
  log.error('save failed', new Error('failed'));
  log.child({ requestId: '123' }).info('ready');
  const closing: Promise<void> = log.close();
  void closing;
  // @ts-expect-error A number is not structured metadata.
  log.info('saved', 123);
  // @ts-expect-error Two messages are not interpolation.
  log.info('saved', 'another message');
  // @ts-expect-error Object-first calls take a message, not a second metadata object.
  log.info({ id: 1 }, { id: 2 });
  // @ts-expect-error A log call requires an input.
  log.info();
  // @ts-expect-error Generic levels enforce the same argument rules.
  log.logWithLevel('audit', 'saved', 'another message');
}
