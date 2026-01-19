import { Platform, PlatformAdapter } from './types';
import { PLATFORM_DOMAINS } from './constants';

export const detectPlatform = (url: string): Platform => {
  const hostname = new URL(url).hostname.toLowerCase();
  
  for (const [platform, domains] of Object.entries(PLATFORM_DOMAINS)) {
    if (domains.some(domain => hostname.includes(domain))) {
      return platform as Platform;
    }
  }
  
  return 'website';
};

export const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const getElementDimensions = (element: HTMLElement): { width: number; height: number } => {
  const rect = element.getBoundingClientRect();
  return {
    width: rect.width,
    height: rect.height,
  };
};

export const createOverlayContainer = (originalElement: HTMLElement): HTMLElement => {
  const overlay = document.createElement('div');
  overlay.style.position = 'absolute';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.zIndex = '9999';
  overlay.setAttribute('data-slop-overlay', 'true');
  
  const rect = originalElement.getBoundingClientRect();
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
  
  return overlay;
};
