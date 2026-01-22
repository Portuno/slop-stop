import { BaseAdapter } from './adapter-interface';
import { Platform } from '../shared/types';
import { PLATFORM_DOMAINS } from '../shared/constants';

export class TwitterAdapter extends BaseAdapter {
  getPlatformName(): Platform {
    return 'twitter';
  }

  canHandleUrl(url: string): boolean {
    const hostname = new URL(url).hostname.toLowerCase();
    return PLATFORM_DOMAINS.twitter.some(domain => hostname.includes(domain));
  }

  getItemSelector(): string {
    return 'article[data-testid="tweet"]';
  }

  getItemId(element: HTMLElement): string | null {
    const tweetId = element.getAttribute('data-tweet-id');
    if (tweetId) {
      return tweetId;
    }

    const link = element.querySelector<HTMLAnchorElement>('a[href*="/status/"]');
    if (link) {
      const match = link.href.match(/\/status\/(\d+)/);
      if (match) {
        return match[1];
      }
    }

    const ariaLabel = element.getAttribute('aria-labelledby');
    if (ariaLabel) {
      return ariaLabel;
    }

    return null;
  }

  getUserIdentifier(element: HTMLElement): string | null {
    // Strategy 1: Look for profile links in the tweet header
    // Twitter/X uses links like twitter.com/username or x.com/username
    const profileLinks = element.querySelectorAll<HTMLAnchorElement>('a[href*="/"]');
    for (const link of Array.from(profileLinks)) {
      const href = link.href;
      // Match patterns like twitter.com/username or x.com/username (but not /status/, /i/, etc.)
      const match = href.match(/(?:twitter\.com|x\.com)\/([^\/\?]+)/);
      if (match && match[1]) {
        const username = match[1];
        // Skip common non-username paths
        if (!['status', 'i', 'home', 'explore', 'notifications', 'messages', 'search', 'settings', 'logout'].includes(username.toLowerCase())) {
          return username;
        }
      }
    }

    // Strategy 2: Look for data attributes that might contain username
    const userElement = element.querySelector('[data-testid="User-Name"]');
    if (userElement) {
      const link = userElement.querySelector<HTMLAnchorElement>('a[href*="/"]');
      if (link) {
        const match = link.href.match(/(?:twitter\.com|x\.com)\/([^\/\?]+)/);
        if (match && match[1]) {
          return match[1];
        }
      }
    }

    // Strategy 3: Look for @ mentions in the tweet text (less reliable, but fallback)
    const textContent = element.textContent || '';
    const mentionMatch = textContent.match(/@([a-zA-Z0-9_]+)/);
    if (mentionMatch && mentionMatch[1]) {
      // This is less reliable as it might be a mention, not the author
      // But we'll use it as a last resort
      return mentionMatch[1];
    }

    return null;
  }

  createGhostContainer(originalElement: HTMLElement): HTMLElement {
    // The Anchor: Set the main post container to position: relative
    // IMPORTANT: Keep the container visible and positioned correctly
    const computedStyle = window.getComputedStyle(originalElement);
    if (computedStyle.position === 'static') {
      originalElement.style.position = 'relative';
    }
    // Ensure the container itself maintains visibility for layout
    originalElement.style.visibility = 'visible';
    originalElement.style.opacity = '1';
    
    // Store original height to ensure overlay covers it completely
    const originalHeight = originalElement.offsetHeight || originalElement.getBoundingClientRect().height;
    if (originalHeight > 0) {
      // Ensure container maintains minimum height
      originalElement.style.minHeight = `${originalHeight}px`;
    }
    
    // The Ghosting: Hide ONLY the children inside the container, not the container itself
    // This ensures the container maintains its space in the grid
    const children = Array.from(originalElement.children) as HTMLElement[];
    children.forEach((child) => {
      // Skip if it's already our overlay
      if (child.getAttribute('data-slop-overlay') === 'true') {
        return;
      }
      child.style.visibility = 'hidden';
      child.style.pointerEvents = 'none';
    });
    
    // Also hide any images, videos, or other media directly in the element
    const images = originalElement.querySelectorAll('img, video, svg');
    images.forEach((media) => {
      (media as HTMLElement).style.visibility = 'hidden';
      (media as HTMLElement).style.pointerEvents = 'none';
    });
    
    // Disable pointer events on the container itself (but keep it visible for layout)
    originalElement.style.pointerEvents = 'none';
    
    // The Replacement: Create overlay as absolute child covering 100% of container
    const overlay = document.createElement('div');
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    if (originalHeight > 0) {
      overlay.style.minHeight = `${originalHeight}px`; // Ensure minimum height matches original
    }
    // Copy border-radius from the original element to match exactly
    overlay.style.borderRadius = computedStyle.borderRadius || '16px';
    overlay.style.zIndex = '999999'; // Very high z-index to ensure it's above Twitter elements
    overlay.style.opacity = '1';
    overlay.style.visibility = 'visible';
    overlay.style.display = 'flex';
    overlay.style.pointerEvents = 'auto';
    overlay.style.overflow = 'hidden'; // Prevent content from spilling out
    overlay.setAttribute('data-slop-overlay', 'true');
    
    // Insert overlay as a child of the original element (not body)
    originalElement.appendChild(overlay);
    
    return overlay;
  }
}
