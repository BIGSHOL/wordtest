import { reportClientError } from '../services/errorLog';

export function initGlobalErrorHandlers(): void {
  window.onerror = (message, source, lineno, colno, error) => {
    reportClientError({
      level: 'error',
      message: typeof message === 'string' ? message : 'Unknown JS error',
      detail: JSON.stringify({ source, lineno, colno }),
      stack_trace: error?.stack,
      endpoint: window.location.pathname,
    });
  };

  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason;
    reportClientError({
      level: 'error',
      message: error?.message || 'Unhandled promise rejection',
      stack_trace: error?.stack,
      endpoint: window.location.pathname,
    });
  });
}
