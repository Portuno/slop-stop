/**
 * Logger utility for Slop-Stop extension
 * In production builds, all debug logs are disabled for performance and privacy
 * 
 * ENABLE_LOGS is replaced by esbuild define during build:
 * - true in development/watch mode  
 * - false in production builds
 */

// No-op functions for production (will be tree-shaken by bundler)
const noop = (): void => { /* no-op */ };

// This will be replaced by esbuild define - use a pattern that esbuild can replace
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ENABLE_LOGS = typeof __ENABLE_LOGS__ !== 'undefined' ? __ENABLE_LOGS__ : false;

export const logger = {
  log: ENABLE_LOGS ? (...args: unknown[]) => console.log(...args) : noop,
  debug: ENABLE_LOGS ? (...args: unknown[]) => console.debug(...args) : noop,
  warn: (...args: unknown[]) => console.warn(...args), // Keep warnings for important issues
  error: (...args: unknown[]) => console.error(...args), // Always log errors
  info: ENABLE_LOGS ? (...args: unknown[]) => console.info(...args) : noop,
};
