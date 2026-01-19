import { BaseAdapter } from './adapter-interface';
import { Platform } from '../shared/types';
import { PLATFORM_DOMAINS } from '../shared/constants';

export class YouTubeAdapter extends BaseAdapter {
  getPlatformName(): Platform {
    return 'youtube';
  }

  canHandleUrl(url: string): boolean {
    const hostname = new URL(url).hostname.toLowerCase();
    return PLATFORM_DOMAINS.youtube.some(domain => hostname.includes(domain));
  }

  getItemSelector(): string {
    return 'ytd-rich-item-renderer, ytd-video-renderer';
  }

  getItemId(element: HTMLElement): string | null {
    const videoId = element.getAttribute('data-video-id');
    if (videoId) {
      return videoId;
    }

    const link = element.querySelector<HTMLAnchorElement>('a[href*="/watch?v="]');
    if (link) {
      const url = new URL(link.href);
      const v = url.searchParams.get('v');
      if (v) {
        return v;
      }
    }

    const shortLink = element.querySelector<HTMLAnchorElement>('a[href*="/shorts/"]');
    if (shortLink) {
      const match = shortLink.href.match(/\/shorts\/([^/?]+)/);
      if (match) {
        return match[1];
      }
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
    
    const videoId = this.getItemId(originalElement);
    
    // The Ghosting: Hide ONLY the children inside the container, not the container itself
    const children = Array.from(originalElement.children) as HTMLElement[];
    children.forEach((child) => {
      // Skip if it's already our overlay
      if (child.getAttribute('data-slop-overlay') === 'true') {
        return;
      }
      child.style.visibility = 'hidden';
      child.style.pointerEvents = 'none';
    });
    
    // Hide images and video thumbnails within the element
    const images = originalElement.querySelectorAll('img, yt-img-shadow img, yt-image img');
    images.forEach((img) => {
      (img as HTMLElement).style.visibility = 'hidden';
      (img as HTMLElement).style.pointerEvents = 'none';
    });
    
    // Hide video thumbnails and previews
    const videos = originalElement.querySelectorAll('video, ytd-thumbnail video');
    videos.forEach((video) => {
      (video as HTMLElement).style.visibility = 'hidden';
      (video as HTMLElement).style.pointerEvents = 'none';
    });
    
    // Hide any background images
    const elementsWithBg = originalElement.querySelectorAll('[style*="background-image"]');
    elementsWithBg.forEach((el) => {
      const htmlEl = el as HTMLElement;
      htmlEl.style.backgroundImage = 'none';
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
    overlay.style.zIndex = '99999'; // Very high z-index to ensure it's above YouTube elements
    overlay.style.opacity = '1';
    overlay.style.display = 'flex';
    overlay.style.visibility = 'visible';
    overlay.style.pointerEvents = 'auto';
    overlay.style.overflow = 'hidden'; // Prevent content from spilling out
    overlay.setAttribute('data-slop-overlay', 'true');
    overlay.setAttribute('data-video-id', videoId || '');
    
    // Insert overlay as a child of the original element
    originalElement.appendChild(overlay);
    
    return overlay;
  }
}
