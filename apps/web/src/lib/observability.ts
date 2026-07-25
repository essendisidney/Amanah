/**
 * Lightweight structured logger + optional Sentry hook points.
 * Install `@sentry/nextjs` and set NEXT_PUBLIC_SENTRY_DSN to enable capture.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogFields = Record<string, unknown>;

function emit(level: LogLevel, message: string, fields?: LogFields) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    service: 'amanah-web',
    ...fields,
  };

  const line = JSON.stringify(payload);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.info(line);
}

export const logger = {
  debug: (message: string, fields?: LogFields) => emit('debug', message, fields),
  info: (message: string, fields?: LogFields) => emit('info', message, fields),
  warn: (message: string, fields?: LogFields) => emit('warn', message, fields),
  error: (message: string, fields?: LogFields) => emit('error', message, fields),
};

/** Capture exception: always logs; forwards to Sentry when a global hook is registered. */
export function captureException(error: unknown, context?: LogFields): void {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(message, {
    ...context,
    stack: error instanceof Error ? error.stack : undefined,
  });

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  const sentry = (
    globalThis as unknown as {
      Sentry?: { captureException: (err: unknown, hint?: { extra?: LogFields }) => void };
    }
  ).Sentry;

  sentry?.captureException(error, { extra: context });
}
