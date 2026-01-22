import * as Sentry from '@sentry/node';

/**
 * Initialize Sentry for error tracking
 */
export function initSentry() {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    console.warn('Sentry DSN not configured. Error tracking disabled.');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  });
}

