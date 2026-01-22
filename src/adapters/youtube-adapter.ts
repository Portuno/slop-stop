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
    // Strategy 1: Check data-video-id attribute on the element itself (most reliable)
    const videoId = element.getAttribute('data-video-id');
    if (videoId && videoId.length >= 11) {
      return videoId;
    }

    // Strategy 2: Check for video ID in ytd-thumbnail elements FIRST (most reliable link location)
    // YouTube's thumbnail component contains the primary video link
    const thumbnails = element.querySelectorAll('ytd-thumbnail, yt-img-shadow');
    for (const thumbnail of Array.from(thumbnails)) {
      const thumbnailLink = thumbnail.querySelector<HTMLAnchorElement>('a[href*="/watch"], a[href*="/shorts/"]');
      if (thumbnailLink) {
        const href = thumbnailLink.href;
        
        if (href.includes('/watch')) {
          try {
            const url = new URL(href);
            const v = url.searchParams.get('v');
            if (v && v.length >= 11) {
              return v;
            }
          } catch (e) {
            // If URL parsing fails, try regex fallback
            const match = href.match(/[?&]v=([^&]+)/);
            if (match && match[1] && match[1].length >= 11) {
              return match[1];
            }
          }
        }
        
        if (href.includes('/shorts/')) {
          const match = href.match(/\/shorts\/([^/?&]+)/);
          if (match && match[1] && match[1].length >= 11) {
            return match[1];
          }
        }
      }
    }

    // Strategy 3: Check for video ID in the main video title/link (usually in ytd-video-meta-block or similar)
    // Look for links that are likely the main video link (not channel links, etc.)
    const mainVideoLinks = element.querySelectorAll<HTMLAnchorElement>('a[href*="/watch"], a[href*="/shorts/"]');
    const videoIds = new Set<string>();
    
    for (const link of Array.from(mainVideoLinks)) {
      const href = link.href;
      
      // Skip channel links and other non-video links
      if (href.includes('/channel/') || href.includes('/user/') || href.includes('/c/') || href.includes('/@')) {
        continue;
      }
      
      let foundId: string | null = null;
      
      if (href.includes('/watch')) {
        try {
          const url = new URL(href);
          const v = url.searchParams.get('v');
          if (v && v.length >= 11) {
            foundId = v;
          }
        } catch (e) {
          const match = href.match(/[?&]v=([^&]+)/);
          if (match && match[1] && match[1].length >= 11) {
            foundId = match[1];
          }
        }
      } else if (href.includes('/shorts/')) {
        const match = href.match(/\/shorts\/([^/?&]+)/);
        if (match && match[1] && match[1].length >= 11) {
          foundId = match[1];
        }
      }
      
      if (foundId) {
        videoIds.add(foundId);
      }
    }
    
    // If we found exactly one unique video ID, use it
    // If multiple IDs found, prioritize the one that appears in thumbnail or title area
    if (videoIds.size === 1) {
      return Array.from(videoIds)[0];
    } else if (videoIds.size > 1) {
      // Multiple video IDs found - this shouldn't happen for a single video element
      // Try to find the one in the title/link area (not in related videos)
      const titleLink = element.querySelector<HTMLAnchorElement>('a#video-title, a[href*="/watch"]:not([href*="/channel"]):not([href*="/user"]):not([href*="/c/"]):not([href*="/@"])');
      if (titleLink) {
        const href = titleLink.href;
        if (href.includes('/watch')) {
          try {
            const url = new URL(href);
            const v = url.searchParams.get('v');
            if (v && v.length >= 11 && videoIds.has(v)) {
              return v;
            }
          } catch (e) {
            const match = href.match(/[?&]v=([^&]+)/);
            if (match && match[1] && match[1].length >= 11 && videoIds.has(match[1])) {
              return match[1];
            }
          }
        }
      }
      // If we can't determine which one, return the first one (better than null)
      return Array.from(videoIds)[0];
    }

    // Strategy 4: Search in parent elements (up to 3 levels) for video ID
    // This handles cases where the video ID might be on a parent container
    let parent = element.parentElement;
    let depth = 0;
    while (parent && depth < 3) {
      const parentVideoId = parent.getAttribute('data-video-id');
      if (parentVideoId && parentVideoId.length >= 11) {
        return parentVideoId;
      }
      
      // Check parent's thumbnail links
      const parentThumbnails = parent.querySelectorAll('ytd-thumbnail, yt-img-shadow');
      for (const thumbnail of Array.from(parentThumbnails)) {
        const thumbnailLink = thumbnail.querySelector<HTMLAnchorElement>('a[href*="/watch"], a[href*="/shorts/"]');
        if (thumbnailLink) {
          const href = thumbnailLink.href;
          
          if (href.includes('/watch')) {
            try {
              const url = new URL(href);
              const v = url.searchParams.get('v');
              if (v && v.length >= 11) {
                return v;
              }
            } catch (e) {
              const match = href.match(/[?&]v=([^&]+)/);
              if (match && match[1] && match[1].length >= 11) {
                return match[1];
              }
            }
          }
          
          if (href.includes('/shorts/')) {
            const match = href.match(/\/shorts\/([^/?&]+)/);
            if (match && match[1] && match[1].length >= 11) {
              return match[1];
            }
          }
        }
      }
      
      parent = parent.parentElement;
      depth++;
    }

    return null;
  }

  getUserIdentifier(element: HTMLElement): string | null {
    // Strategy 1: Look for channel links with @username format (preferred)
    // YouTube uses /@username for modern channel URLs
    const channelLinks = element.querySelectorAll<HTMLAnchorElement>('a[href*="/@"]');
    for (const link of Array.from(channelLinks)) {
      const href = link.href;
      const match = href.match(/youtube\.com\/@([^\/\?]+)/);
      if (match && match[1]) {
        return `@${match[1]}`;
      }
    }

    // Strategy 2: Look for /channel/CHANNEL_ID or /c/username or /user/USERNAME
    const allChannelLinks = element.querySelectorAll<HTMLAnchorElement>('a[href*="/channel/"], a[href*="/c/"], a[href*="/user/"]');
    for (const link of Array.from(allChannelLinks)) {
      const href = link.href;
      
      // Try /c/username first (custom channel URL)
      let match = href.match(/youtube\.com\/c\/([^\/\?]+)/);
      if (match && match[1]) {
        return match[1];
      }
      
      // Try /user/USERNAME
      match = href.match(/youtube\.com\/user\/([^\/\?]+)/);
      if (match && match[1]) {
        return match[1];
      }
      
      // Try /channel/CHANNEL_ID (use as fallback, but prefer username)
      match = href.match(/youtube\.com\/channel\/([^\/\?]+)/);
      if (match && match[1]) {
        // Channel IDs are long strings, but we'll use them if no username found
        return match[1];
      }
    }

    // Strategy 3: Look for channel name in ytd-channel-name element
    const channelNameElement = element.querySelector('ytd-channel-name a, #channel-name a');
    if (channelNameElement) {
      const href = (channelNameElement as HTMLAnchorElement).href;
      if (href) {
        const match = href.match(/youtube\.com\/@([^\/\?]+)/);
        if (match && match[1]) {
          return `@${match[1]}`;
        }
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
