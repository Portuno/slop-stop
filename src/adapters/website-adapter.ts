import { BaseAdapter } from './adapter-interface';
import { Platform } from '../shared/types';
import { PLATFORM_DOMAINS } from '../shared/constants';

export class WebsiteAdapter extends BaseAdapter {
  getPlatformName(): Platform {
    return 'website';
  }

  canHandleUrl(url: string): boolean {
    const hostname = new URL(url).hostname.toLowerCase();
    const allOtherDomains = [
      ...PLATFORM_DOMAINS.twitter,
      ...PLATFORM_DOMAINS.youtube,
      ...PLATFORM_DOMAINS.linkedin,
    ];
    return !allOtherDomains.some(domain => hostname.includes(domain));
  }

  getItemSelector(): string {
    return 'body';
  }

  getItemId(element: HTMLElement): string | null {
    return window.location.href;
  }

  getUserIdentifier(element: HTMLElement): string | null {
    // For websites, extract the domain from the current URL
    try {
      const url = new URL(window.location.href);
      // Return the hostname (domain) without www. prefix for consistency
      const domain = url.hostname.replace(/^www\./, '');
      return domain;
    } catch (error) {
      // If URL parsing fails, return null
      return null;
    }
  }

  createGhostContainer(originalElement: HTMLElement): HTMLElement {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.zIndex = '99999';
    overlay.setAttribute('data-slop-overlay', 'true');
    
    document.body.appendChild(overlay);
    
    return overlay;
  }
}
