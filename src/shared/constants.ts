import { Platform } from './types';

export const DEFAULT_REPORT_LIMIT_THRESHOLD = 5;

export const STORAGE_KEYS = {
  REPORTER_HASH: 'reporter_hash',
  SETTINGS: 'settings',
} as const;

export const PLATFORM_SELECTORS: Record<Platform, string> = {
  twitter: 'article[data-testid="tweet"]',
  youtube: 'ytd-rich-item-renderer, ytd-video-renderer',
  linkedin: '[data-urn*="urn:li:activity:"]',
  website: 'body',
};

export const PLATFORM_DOMAINS: Record<Platform, string[]> = {
  twitter: ['twitter.com', 'x.com'],
  youtube: ['youtube.com'],
  linkedin: ['linkedin.com'],
  website: [],
};

export const MESSAGE_TYPES = {
  REPORT_SLOP: 'REPORT_SLOP',
  REPORT_WEBSITE: 'REPORT_WEBSITE',
  GET_SLOP_STATUS: 'GET_SLOP_STATUS',
  GET_SETTINGS: 'GET_SETTINGS',
  SET_SETTINGS: 'SET_SETTINGS',
  SUBMIT_FEEDBACK: 'SUBMIT_FEEDBACK',
} as const;
