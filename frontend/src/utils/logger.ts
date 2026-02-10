const isDev = import.meta.env.DEV;

/**
 * Development-only logger. Calls are no-ops in production builds.
 */
export const logger = {
  error: (...args: unknown[]) => {
    if (isDev) console.error(...args);
  },
  warn: (...args: unknown[]) => {
    if (isDev) console.warn(...args);
  },
};
