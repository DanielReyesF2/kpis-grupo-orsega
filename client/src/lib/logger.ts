/**
 * Development-only logger utility
 * All logs are stripped in production builds
 */

const isDev = import.meta.env.DEV;

type LogLevel = 'log' | 'warn' | 'error' | 'debug' | 'info';

interface Logger {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
}

const noop = () => {};

/**
 * Dev-only logger - all methods are no-ops in production
 */
export const devLog: Logger = {
  log: isDev ? (...args: unknown[]) => console.log(...args) : noop,
  warn: isDev ? (...args: unknown[]) => console.warn(...args) : noop,
  error: isDev ? (...args: unknown[]) => console.error(...args) : noop,
  debug: isDev ? (...args: unknown[]) => console.debug(...args) : noop,
  info: isDev ? (...args: unknown[]) => console.info(...args) : noop,
};

/**
 * Create a namespaced logger for a specific module
 */
export function createLogger(namespace: string): Logger {
  const prefix = `[${namespace}]`;
  return {
    log: isDev ? (...args: unknown[]) => console.log(prefix, ...args) : noop,
    warn: isDev ? (...args: unknown[]) => console.warn(prefix, ...args) : noop,
    error: isDev ? (...args: unknown[]) => console.error(prefix, ...args) : noop,
    debug: isDev ? (...args: unknown[]) => console.debug(prefix, ...args) : noop,
    info: isDev ? (...args: unknown[]) => console.info(prefix, ...args) : noop,
  };
}

export default devLog;
