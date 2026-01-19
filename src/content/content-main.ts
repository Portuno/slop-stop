import { TwitterAdapter } from '../adapters/twitter-adapter';
import { YouTubeAdapter } from '../adapters/youtube-adapter';
import { LinkedInAdapter } from '../adapters/linkedin-adapter';
import { WebsiteAdapter } from '../adapters/website-adapter';
import { PlatformAdapter, MessageType, Platform } from '../shared/types';
import { detectPlatform } from '../shared/utils';
import { createSlopCurtain } from './slop-curtain';
import { initializeHotkeys } from './hotkeys';

interface ProcessedItem {
  element: HTMLElement;
  itemId: string;
  overlay: HTMLElement | null;
  isShowing: boolean;
}

const processedItems = new Map<HTMLElement, ProcessedItem>();
const processingItems = new Set<HTMLElement>(); // Track items currently being processed
let currentAdapter: PlatformAdapter | null = null;
let isExtensionContextValid = true;

// Helper function to find processed item by itemId
const findProcessedItemByItemId = (itemId: string): ProcessedItem | null => {
  for (const item of processedItems.values()) {
    if (item.itemId === itemId && item.overlay && item.overlay.parentNode !== null) {
      return item;
    }
  }
  return null;
};

const isContextInvalidated = (error: chrome.runtime.LastError | undefined): boolean => {
  if (!error) return false;
  return error.message?.includes('Extension context invalidated') || 
         error.message?.includes('message port closed') ||
         error.message?.includes('Receiving end does not exist') ||
         false;
};

const handleContextInvalidated = (): void => {
  if (!isExtensionContextValid) return;
  
  isExtensionContextValid = false;
  console.warn('[Slop-Stop] Extension context invalidated, stopping evaluation');
  
  // Clean up all overlays and restore elements
  processedItems.forEach((item) => {
    if (item.overlay) {
      // Clean up overlay event listeners
      if ((item.overlay as any).__slopCleanup) {
        (item.overlay as any).__slopCleanup();
      }
      if (item.overlay.parentNode) {
        item.overlay.parentNode.removeChild(item.overlay);
      }
    }
    if (item.element) {
      item.element.style.opacity = '';
      item.element.style.visibility = '';
      item.element.style.pointerEvents = '';
    }
  });
  
  processedItems.clear();
  
  // Remove all trash icons
  document.querySelectorAll('[data-slop-trash-icon]').forEach((icon) => {
    icon.remove();
  });
  
  // Remove all overlays and clean up their listeners
  document.querySelectorAll('[data-slop-overlay]').forEach((overlay) => {
    if ((overlay as any).__slopCleanup) {
      (overlay as any).__slopCleanup();
    }
    overlay.remove();
  });
};

const getAdapter = (): PlatformAdapter => {
  const url = window.location.href;
  
  if (currentAdapter && currentAdapter.canHandleUrl(url)) {
    return currentAdapter;
  }

  const platform = detectPlatform(url);
  
  switch (platform) {
    case 'twitter':
      currentAdapter = new TwitterAdapter();
      break;
    case 'youtube':
      currentAdapter = new YouTubeAdapter();
      break;
    case 'linkedin':
      currentAdapter = new LinkedInAdapter();
      break;
    default:
      currentAdapter = new WebsiteAdapter();
  }

  return currentAdapter;
};

const checkSlopStatus = async (itemId: string, platform: Platform): Promise<{ isSlop: boolean; reportCount: number }> => {
  if (!isExtensionContextValid) {
    return { isSlop: false, reportCount: 0 };
  }
  
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(
        {
          type: MessageType.GET_SLOP_STATUS,
          payload: { itemId, platform },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            if (isContextInvalidated(chrome.runtime.lastError)) {
              handleContextInvalidated();
            } else {
              const errorMsg = chrome.runtime.lastError.message || 'Unknown error';
              console.error('[Slop-Stop] Error checking slop status:', errorMsg);
            }
            resolve({ isSlop: false, reportCount: 0 });
            return;
          }
          resolve(response || { isSlop: false, reportCount: 0 });
        }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Extension context invalidated')) {
        handleContextInvalidated();
      } else {
        console.error('[Slop-Stop] Exception checking slop status:', errorMessage);
      }
      resolve({ isSlop: false, reportCount: 0 });
    }
  });
};

const reportSlop = async (itemId: string, platform: Platform): Promise<void> => {
  if (!isExtensionContextValid) {
    console.warn('[Slop-Stop] reportSlop: context invalidated, returning');
    return Promise.resolve(); // Silently resolve instead of rejecting
  }
  
  return new Promise((resolve, reject) => {
    try {
      console.log('[Slop-Stop] reportSlop: sending message', { itemId, platform });
      chrome.runtime.sendMessage(
        {
          type: MessageType.REPORT_SLOP,
          payload: { itemId, platform },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error('[Slop-Stop] reportSlop: chrome.runtime.lastError', chrome.runtime.lastError);
            if (isContextInvalidated(chrome.runtime.lastError)) {
              handleContextInvalidated();
              resolve(); // Silently resolve instead of rejecting
            } else {
              reject(chrome.runtime.lastError);
            }
            return;
          }
          console.log('[Slop-Stop] reportSlop: received response', response);
          if (response && response.error) {
            console.error('[Slop-Stop] reportSlop: response contains error', response.error);
            reject(new Error(response.error));
            return;
          }
          if (response && response.success === false) {
            console.error('[Slop-Stop] reportSlop: response.success is false', response);
            reject(new Error(response.error || 'Report failed'));
            return;
          }
          console.log('[Slop-Stop] reportSlop: success', response);
          resolve();
        }
      );
    } catch (error) {
      console.error('[Slop-Stop] reportSlop: exception', error);
      if (error instanceof Error && error.message.includes('Extension context invalidated')) {
        handleContextInvalidated();
        resolve(); // Silently resolve instead of rejecting
      } else {
        reject(error);
      }
    }
  });
};

const reportWebsite = async (): Promise<{ shouldBlock: boolean }> => {
  if (!isExtensionContextValid) {
    return { shouldBlock: false };
  }
  
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(
        {
          type: MessageType.REPORT_WEBSITE,
          payload: { url: window.location.href },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            if (isContextInvalidated(chrome.runtime.lastError)) {
              handleContextInvalidated();
            } else {
              console.error('Error reporting website:', chrome.runtime.lastError);
            }
            resolve({ shouldBlock: false });
            return;
          }
          resolve(response || { shouldBlock: false });
        }
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes('Extension context invalidated')) {
        handleContextInvalidated();
      }
      resolve({ shouldBlock: false });
    }
  });
};

const processItem = async (element: HTMLElement, adapter: PlatformAdapter, forceOverlay: boolean = false): Promise<void> => {
  // #region agent log
  const logData = {location:'content-main.ts:230',message:'processItem called',data:{forceOverlay:forceOverlay,elementTagName:element.tagName,elementClassName:element.className?.substring(0,50),elementId:element.id?.substring(0,30),isConnected:element.isConnected,timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'}};
  fetch('http://127.0.0.1:7243/ingest/b2719b1f-0fda-42ef-a1bf-85265994e0a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch(()=>{});
  // #endregion
  
  // Check if element is still in the DOM
  if (!element.isConnected) {
    return;
  }

  const itemId = adapter.getItemId(element);
  
  // #region agent log
  const logData2 = {location:'content-main.ts:236',message:'Got itemId',data:{itemId:itemId,forceOverlay:forceOverlay,timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'}};
  fetch('http://127.0.0.1:7243/ingest/b2719b1f-0fda-42ef-a1bf-85265994e0a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData2)}).catch(()=>{});
  // #endregion
  
  if (!itemId) {
    return;
  }

  // Check if any element with this itemId already has an overlay
  if (!forceOverlay) {
    const existingItemByItemId = findProcessedItemByItemId(itemId);
    if (existingItemByItemId) {
      // If the existing element is different but connected, update the map to use current element
      if (existingItemByItemId.element !== element && element.isConnected) {
        processedItems.delete(existingItemByItemId.element);
        processedItems.set(element, existingItemByItemId);
      }
      return;
    }
  }

  const existingItem = processedItems.get(element);
  if (existingItem) {
    // If element already has an overlay, don't process again (unless forcing)
    if (existingItem.overlay && !forceOverlay) {
      return;
    }
    // If element is showing (overlay was removed), don't process again unless forcing
    if (existingItem.isShowing && !forceOverlay) {
      return;
    }
    // If forcing overlay and one exists, remove it first
    if (existingItem.overlay && forceOverlay) {
      // Clean up existing overlay
      if ((existingItem.overlay as any).__slopCleanup) {
        (existingItem.overlay as any).__slopCleanup();
      }
      if (existingItem.overlay.parentNode) {
        existingItem.overlay.parentNode.removeChild(existingItem.overlay);
      }
      // Remove from processedItems to allow reprocessing
      processedItems.delete(element);
    } else if (existingItem.isShowing) {
      // If element was showing but now needs to be hidden again, remove from processedItems to reprocess
      processedItems.delete(element);
    } else if (!forceOverlay) {
      return;
    }
  }

  const platform = adapter.getPlatformName();
  const status = await checkSlopStatus(itemId, platform);

  // #region agent log
  const logData3 = {location:'content-main.ts:284',message:'Slop status checked',data:{itemId:itemId,isSlop:status.isSlop,forceOverlay:forceOverlay,reportCount:status.reportCount,willCreateOverlay:status.isSlop||forceOverlay,timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'}};
  fetch('http://127.0.0.1:7243/ingest/b2719b1f-0fda-42ef-a1bf-85265994e0a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData3)}).catch(()=>{});
  // #endregion

  // If forcing overlay (e.g., after reporting slop), create it even if status hasn't updated yet
  if (!status.isSlop && !forceOverlay) {
    return;
  }

  // If forcing overlay, ensure we have at least 1 report count
  const reportCount = forceOverlay && status.reportCount === 0 ? 1 : status.reportCount;

  const overlay = adapter.createGhostContainer(element);
  // Mark overlay creation time to prevent premature cleanup
  (overlay as any).__createdAt = Date.now();
  // Ensure overlay allows pointer events for buttons
  overlay.style.pointerEvents = 'auto';
  
  // IMPORTANT: Ensure trash icon is visible above overlay
  // Move trash icon to be a child of overlay so it's always visible
  const trashIcon = element.querySelector('[data-slop-trash-icon]') as HTMLElement;
  if (trashIcon && trashIcon.parentElement === element) {
    // Move trash icon to overlay so it's always visible
    overlay.appendChild(trashIcon);
    // Update z-index to ensure it's above overlay content
    trashIcon.style.zIndex = '1000000';
  }
  
  const curtain = createSlopCurtain({
    reportCount: reportCount,
    onShow: () => {
      const item = processedItems.get(element);
      if (!item || item.isShowing) {
        return; // Already showing or item not found
      }
      
      // Check if element is still in the DOM
      if (!element.isConnected) {
        // Element was removed, clean up
        if (item.overlay && item.overlay.parentNode) {
          item.overlay.parentNode.removeChild(item.overlay);
        }
        processedItems.delete(element);
        return;
      }
      
      // Mark as showing first to prevent double-clicks
      item.isShowing = true;
      
      // Clean up overlay event listeners (for Twitter scroll listeners)
      if ((overlay as any).__slopCleanup) {
        (overlay as any).__slopCleanup();
      }
      
      // Remove overlay from DOM immediately
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      
      // Restore original element visibility - restore all children
      element.style.removeProperty('opacity');
      element.style.removeProperty('pointer-events');
      element.style.removeProperty('visibility'); // Ensure visibility is restored
      element.style.removeProperty('min-height'); // Restore original height behavior
      
      // Restore trash icon to original position if it was moved to overlay
      const trashIcon = overlay.querySelector('[data-slop-trash-icon]') as HTMLElement;
      if (trashIcon && trashIcon.parentElement === overlay) {
        // Move trash icon back to element
        element.appendChild(trashIcon);
        trashIcon.style.zIndex = '999999';
      }
      
      // Restore all children visibility
      const children = Array.from(element.children) as HTMLElement[];
      children.forEach((child) => {
        if (child !== overlay && child.getAttribute('data-slop-overlay') !== 'true') {
          // Don't restore the overlay itself
          child.style.removeProperty('visibility');
          child.style.removeProperty('pointer-events');
        }
      });
      
      // Restore visual content (images, videos) within the element
      const images = element.querySelectorAll('img, yt-img-shadow img, yt-image img, video, ytd-thumbnail video, svg');
      images.forEach((media) => {
        (media as HTMLElement).style.removeProperty('visibility');
        (media as HTMLElement).style.removeProperty('pointer-events');
      });
      
      // Restore element position if we modified it
      const computedStyle = window.getComputedStyle(element);
      if (element.style.position === 'relative' && computedStyle.position === 'relative') {
        // Check if there are other overlays in this element that need this positioning
        const hasOtherOverlays = Array.from(processedItems.values()).some(
          i => i.overlay && i.element === element && i !== item
        );
        if (!hasOtherOverlays) {
          element.style.removeProperty('position');
        }
      }
      
      // Force a reflow to ensure the platform renders the element correctly
      void element.offsetHeight;
      
      // Mark overlay as null in processedItems
      item.overlay = null;
      
      // Re-enable pointer events on the element
      element.style.pointerEvents = '';
    },
    onReport: async () => {
      try {
        await reportSlop(itemId, platform).catch(() => {
          // Silently handle errors - context invalidated is already handled
        });
        // Counter removed - no longer updating UI
      } catch (error) {
        // Silently handle any errors
      }
    },
  });

  overlay.appendChild(curtain);
  // Ensure overlay is visible and properly styled
  overlay.style.display = 'flex';
  overlay.style.opacity = '1';
  overlay.style.visibility = 'visible';

  processedItems.set(element, {
    element,
    itemId,
    overlay,
    isShowing: false,
  });
  
  // #region agent log
  const logData4 = {location:'content-main.ts:411',message:'Overlay created and stored',data:{itemId:itemId,elementTagName:element.tagName,processedItemsCount:processedItems.size,forceOverlay:forceOverlay,timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'}};
  fetch('http://127.0.0.1:7243/ingest/b2719b1f-0fda-42ef-a1bf-85265994e0a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData4)}).catch(()=>{});
  // #endregion
};

const addTrashIconToItem = (element: HTMLElement, adapter: PlatformAdapter): void => {
  if (element.querySelector('[data-slop-trash-icon]')) {
    return;
  }

  // #region agent log
  const isMainFeed = element.tagName === 'MAIN' || element.id === 'workspace';
  const logDataTrash1 = {location:'content-main.ts:440',message:'addTrashIconToItem called',data:{elementTagName:element.tagName,elementClassName:element.className?.substring(0,50),elementId:element.id?.substring(0,30),elementTextLength:element.textContent?.length,elementChildrenCount:element.children.length,isMainFeed:isMainFeed,platform:adapter.getPlatformName(),timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'}};
  fetch('http://127.0.0.1:7243/ingest/b2719b1f-0fda-42ef-a1bf-85265994e0a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logDataTrash1)}).catch(()=>{});
  // #endregion

  // IMPORTANT: For LinkedIn, skip adding trash icon to the main feed container
  // The main feed container is usually <main id="workspace"> or a direct child of it
  if (adapter.getPlatformName() === 'linkedin') {
    // Skip if it's the main feed container
    if (element.tagName === 'MAIN' || element.id === 'workspace') {
      // #region agent log
      const logDataTrashSkip = {location:'content-main.ts:448',message:'Skipping trash icon - main feed container',data:{elementTagName:element.tagName,elementId:element.id,timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'}};
      fetch('http://127.0.0.1:7243/ingest/b2719b1f-0fda-42ef-a1bf-85265994e0a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logDataTrashSkip)}).catch(()=>{});
      // #endregion
      return;
    }
    
    // Skip if it's a direct child of main#workspace (likely the feed container, not individual posts)
    const mainFeed = document.querySelector('main#workspace');
    if (mainFeed && element.parentElement === mainFeed) {
      // Check if it looks like an individual post (has substantial content and reasonable size)
      const textLength = element.textContent?.length || 0;
      const buttons = element.querySelectorAll('button, [role="button"]').length;
      const hasSubstantialContent = (element.children.length >= 1 || buttons >= 1) && 
                                   (textLength > 50 || element.querySelector('img, video'));
      // If it's too large (more than 5000 chars), it's likely the feed container
      // But allow posts with engagement buttons even if they're direct children
      if (textLength > 5000 && buttons < 2) {
        // #region agent log
        const logDataTrashSkip2 = {location:'content-main.ts:460',message:'Skipping trash icon - likely feed container',data:{elementTagName:element.tagName,elementId:element.id,textLength:textLength,hasSubstantialContent:hasSubstantialContent,buttons:buttons,isDirectChildOfMain:true,timestamp:Date.now(),sessionId:'debug-session',runId:'run4',hypothesisId:'A'}};
        fetch('http://127.0.0.1:7243/ingest/b2719b1f-0fda-42ef-a1bf-85265994e0a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logDataTrashSkip2)}).catch(()=>{});
        // #endregion
        return;
      }
      
      // If it doesn't have substantial content, skip it
      if (!hasSubstantialContent && textLength < 50) {
        // #region agent log
        const logDataTrashSkip3 = {location:'content-main.ts:475',message:'Skipping trash icon - no substantial content',data:{elementTagName:element.tagName,elementId:element.id,textLength:textLength,childrenCount:element.children.length,buttons:buttons,isDirectChildOfMain:true,timestamp:Date.now(),sessionId:'debug-session',runId:'run4',hypothesisId:'A'}};
        fetch('http://127.0.0.1:7243/ingest/b2719b1f-0fda-42ef-a1bf-85265994e0a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logDataTrashSkip3)}).catch(()=>{});
        // #endregion
        return;
      }
    }
  }

  const trashIcon = document.createElement('button');
  trashIcon.className = 'slop-item-trash-icon';
  trashIcon.setAttribute('data-slop-trash-icon', 'true');
  trashIcon.setAttribute('aria-label', 'Report as slop');
  trashIcon.setAttribute('tabindex', '0');
  trashIcon.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 4h12M5 4V2a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-6 0v10a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V4M6 7v6M10 7v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
  `;

  const handleTrashClick = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation(); // Prevent LinkedIn from handling the event
    
    // #region agent log
    const logData5 = {location:'content-main.ts:435',message:'Trash icon clicked',data:{elementTagName:element.tagName,elementClassName:element.className?.substring(0,50),elementId:element.id?.substring(0,30),timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'}};
    fetch('http://127.0.0.1:7243/ingest/b2719b1f-0fda-42ef-a1bf-85265994e0a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData5)}).catch(()=>{});
    // #endregion
    
    if (!isExtensionContextValid) {
      console.warn('[Slop-Stop] trashIcon click: context invalidated');
      return;
    }
    
    try {
      const itemId = adapter.getItemId(element);
      
      // #region agent log
      const logData6 = {location:'content-main.ts:446',message:'Trash icon got itemId',data:{itemId:itemId,elementTagName:element.tagName,timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'}};
      fetch('http://127.0.0.1:7243/ingest/b2719b1f-0fda-42ef-a1bf-85265994e0a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData6)}).catch(()=>{});
      // #endregion
      
      if (itemId && isExtensionContextValid) {
        try {
          // Step 1: Report to backend
          await reportSlop(itemId, adapter.getPlatformName());
          
          // Step 2: Immediately trigger Ghost Container UI for immediate relief
          await processItem(element, adapter, true).catch((error) => {
            console.error('[Slop-Stop] trashIcon: processItem failed', error);
          });
        } catch (error) {
          console.error('[Slop-Stop] trashIcon: reportSlop failed', error);
        }
      }
    } catch (error) {
      console.error('[Slop-Stop] trashIcon click: ERROR', error);
    }
  };
  
  // Use capture phase to intercept before LinkedIn handles it
  trashIcon.addEventListener('click', handleTrashClick, true);
  // Also add mousedown to catch it even earlier
  trashIcon.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }, true);

  trashIcon.style.cssText = `
    position: absolute;
    bottom: 0.5rem;
    right: 0.5rem;
    padding: 0.5rem;
    background: rgba(0, 0, 0, 0.6);
    color: #ffffff;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999999;
    opacity: 0;
    transition: opacity 0.2s, background-color 0.2s;
    pointer-events: auto !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  `;

  // Ensure parent element can contain absolutely positioned trash icon
  const computedStyle = window.getComputedStyle(element);
  if (computedStyle.position === 'static') {
    element.style.position = 'relative';
  }
  // Ensure overflow allows trash icon to be visible (but be careful not to break layout)
  // Only change overflow if it's explicitly hidden, not if it's auto/scroll
  if (computedStyle.overflow === 'hidden') {
    // Store original overflow to potentially restore later
    if (!element.hasAttribute('data-slop-original-overflow')) {
      element.setAttribute('data-slop-original-overflow', computedStyle.overflow);
    }
    element.style.overflow = 'visible';
  }
  
  // Use mouseenter/mouseleave on both element and trashIcon for better UX
  const showTrashIcon = () => {
    trashIcon.style.opacity = '1';
  };
  const hideTrashIcon = () => {
    trashIcon.style.opacity = '0';
  };
  
  element.addEventListener('mouseenter', showTrashIcon);
  element.addEventListener('mouseleave', hideTrashIcon);
  
  // Also show trash icon when hovering over the icon itself
  trashIcon.addEventListener('mouseenter', showTrashIcon);
  trashIcon.addEventListener('mouseleave', hideTrashIcon);
  
  // Add hover effect on the trash icon itself
  trashIcon.addEventListener('mouseenter', () => {
    trashIcon.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
  });
  trashIcon.addEventListener('mouseleave', () => {
    trashIcon.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
  });

  // IMPORTANT: Append trash icon to element BEFORE any overlay is created
  // This ensures it's always visible, even when overlay exists
  element.appendChild(trashIcon);
  
  // #region agent log
  const computedStyleAfter = window.getComputedStyle(element);
  const trashIconComputed = window.getComputedStyle(trashIcon);
  const logDataTrashAdded = {location:'content-main.ts:613',message:'Trash icon added successfully',data:{elementTagName:element.tagName,elementClassName:element.className?.substring(0,50),elementId:element.id?.substring(0,30),elementTextLength:element.textContent?.length,platform:adapter.getPlatformName(),elementPosition:computedStyleAfter.position,elementOverflow:computedStyleAfter.overflow,elementZIndex:computedStyleAfter.zIndex,trashIconPosition:trashIconComputed.position,trashIconOpacity:trashIconComputed.opacity,trashIconVisibility:trashIconComputed.visibility,trashIconZIndex:trashIconComputed.zIndex,trashIconDisplay:trashIconComputed.display,trashIconInDOM:trashIcon.isConnected,timestamp:Date.now(),sessionId:'debug-session',runId:'run4',hypothesisId:'C'}};
  fetch('http://127.0.0.1:7243/ingest/b2719b1f-0fda-42ef-a1bf-85265994e0a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logDataTrashAdded)}).catch(()=>{});
  console.log('[Slop-Stop] Trash icon added to element:', {
    tagName: element.tagName,
    className: element.className?.substring(0, 50),
    textLength: element.textContent?.length
  });
  // #endregion
  
  // Store reference to trash icon on element for later access
  (element as any).__slopTrashIcon = trashIcon;
};

// Global error handler for unhandled promise rejections related to extension context
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason;
    if (
      error instanceof Error &&
      (error.message.includes('Extension context invalidated') ||
       error.message.includes('message port closed') ||
       error.message.includes('Receiving end does not exist') ||
       error.message.includes('chrome-extension://invalid'))
    ) {
      event.preventDefault(); // Prevent the error from appearing in console
      handleContextInvalidated();
    }
  });
  
  // Also catch errors from failed resource loads
  window.addEventListener('error', (event) => {
    if (event.message && event.message.includes('chrome-extension://invalid')) {
      event.preventDefault();
      // Silently ignore these errors
      return false;
    }
  }, true);
}

const initializeContentScript = (): void => {
  const adapter = getAdapter();
  
  const handleNewItems = async (items: HTMLElement[]) => {
    if (!isExtensionContextValid) {
      return;
    }
    
    console.log(`[Slop-Stop] handleNewItems called with ${items.length} items`);
    
    // #region agent log
    const logData7 = {location:'content-main.ts:569',message:'handleNewItems called',data:{itemsCount:items.length,items:items.slice(0,3).map(el=>({tagName:el.tagName,className:el.className?.substring(0,50),id:el.id?.substring(0,30)})),timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'A'}};
    fetch('http://127.0.0.1:7243/ingest/b2719b1f-0fda-42ef-a1bf-85265994e0a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData7)}).catch(()=>{});
    // #endregion
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      if (!isExtensionContextValid) {
        break;
      }
      
      // Get itemId first to validate the item
      const itemId = adapter.getItemId(item);
      
      // #region agent log
      const logData8 = {location:'content-main.ts:582',message:'Processing item',data:{itemIndex:i,itemId:itemId,itemTagName:item.tagName,itemClassName:item.className?.substring(0,50),itemIdAttr:item.id?.substring(0,30),timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'}};
      fetch('http://127.0.0.1:7243/ingest/b2719b1f-0fda-42ef-a1bf-85265994e0a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData8)}).catch(()=>{});
      // #endregion
      
      // Skip items without valid IDs (they can't be tracked properly)
      if (!itemId) {
        console.log('[Slop-Stop] Skipping item without ID:', {
          tagName: item.tagName,
          className: item.className?.substring(0, 50),
          textLength: item.textContent?.length
        });
        // #region agent log
        const logDataSkipNoId = {location:'content-main.ts:686',message:'Skipping item - no ID',data:{itemIndex:i,itemTagName:item.tagName,itemClassName:item.className?.substring(0,50),itemIdAttr:item.id?.substring(0,30),itemTextLength:item.textContent?.length,itemChildrenCount:item.children.length,timestamp:Date.now(),sessionId:'debug-session',runId:'run4',hypothesisId:'B'}};
        fetch('http://127.0.0.1:7243/ingest/b2719b1f-0fda-42ef-a1bf-85265994e0a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logDataSkipNoId)}).catch(()=>{});
        // #endregion
        continue;
      }
      
      // Always add trash icon first (before checking if it's slop)
      // Check both in element and in any overlay
      const existingTrashIcon = item.querySelector('[data-slop-trash-icon]') || 
                                document.querySelector(`[data-slop-overlay="true"] [data-slop-trash-icon]`);
      if (!existingTrashIcon) {
        try {
          console.log('[Slop-Stop] Adding trash icon to item:', {
            itemId,
            tagName: item.tagName,
            className: item.className?.substring(0, 50),
            textLength: item.textContent?.length
          });
          // #region agent log
          const logDataBeforeAddTrash = {location:'content-main.ts:699',message:'About to call addTrashIconToItem',data:{itemId:itemId,itemTagName:item.tagName,itemClassName:item.className?.substring(0,50),itemIdAttr:item.id?.substring(0,30),itemTextLength:item.textContent?.length,itemChildrenCount:item.children.length,isConnected:item.isConnected,timestamp:Date.now(),sessionId:'debug-session',runId:'run4',hypothesisId:'A'}};
          fetch('http://127.0.0.1:7243/ingest/b2719b1f-0fda-42ef-a1bf-85265994e0a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logDataBeforeAddTrash)}).catch(()=>{});
          // #endregion
          addTrashIconToItem(item, adapter);
          // #region agent log
          const trashIconAfter = item.querySelector('[data-slop-trash-icon]');
          const logDataAfterAddTrash = {location:'content-main.ts:710',message:'After addTrashIconToItem call',data:{itemId:itemId,trashIconFound:!!trashIconAfter,trashIconInDOM:!!document.querySelector(`[data-slop-trash-icon][data-item-id="${itemId}"]`),itemTagName:item.tagName,timestamp:Date.now(),sessionId:'debug-session',runId:'run4',hypothesisId:'C'}};
          fetch('http://127.0.0.1:7243/ingest/b2719b1f-0fda-42ef-a1bf-85265994e0a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logDataAfterAddTrash)}).catch(()=>{});
          // #endregion
        } catch (error) {
          console.error('[Slop-Stop] Error adding trash icon:', error);
          // #region agent log
          const logDataTrashError = {location:'content-main.ts:714',message:'Error adding trash icon',data:{itemId:itemId,errorMessage:error instanceof Error?error.message:String(error),itemTagName:item.tagName,timestamp:Date.now(),sessionId:'debug-session',runId:'run4',hypothesisId:'A'}};
          fetch('http://127.0.0.1:7243/ingest/b2719b1f-0fda-42ef-a1bf-85265994e0a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logDataTrashError)}).catch(()=>{});
          // #endregion
        }
      } else {
        console.log('[Slop-Stop] Trash icon already exists for item:', {
          itemId,
          tagName: item.tagName
        });
        // #region agent log
        const logDataTrashExists = {location:'content-main.ts:722',message:'Trash icon already exists',data:{itemId:itemId,itemTagName:item.tagName,timestamp:Date.now(),sessionId:'debug-session',runId:'run4',hypothesisId:'A'}};
        fetch('http://127.0.0.1:7243/ingest/b2719b1f-0fda-42ef-a1bf-85265994e0a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logDataTrashExists)}).catch(()=>{});
        // #endregion
      }
      
      // Then process item to check if it's slop and add overlay if needed
      // Check if item already has overlay, is showing, or is currently being processed
      const existingItem = processedItems.get(item);
      const isCurrentlyProcessing = processingItems.has(item);
      
      // Check if there's already an overlay in the DOM for this item
      const hasOverlayInDOM = findProcessedItemByItemId(itemId) !== null;
      
      // Skip if already processing or if overlay exists
      if (isCurrentlyProcessing || hasOverlayInDOM) {
        continue;
      }
      
      // Only process if no existing item OR existing item has no overlay and is not showing
      if (!existingItem || (!existingItem.overlay && !existingItem.isShowing)) {
        // #region agent log
        const hasExistingItem = !!existingItem;
        const hasOverlay = existingItem ? !!existingItem.overlay : false;
        const isShowing = existingItem ? !!existingItem.isShowing : false;
        const logData9 = {location:'content-main.ts:615',message:'About to processItem',data:{itemId:itemId,hasExistingItem:hasExistingItem,hasOverlay:hasOverlay,isShowing:isShowing,timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'}};
        fetch('http://127.0.0.1:7243/ingest/b2719b1f-0fda-42ef-a1bf-85265994e0a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData9)}).catch(()=>{});
        // #endregion
        processingItems.add(item);
        try {
          await processItem(item, adapter).catch((error) => {
            // Silently handle errors
          });
        } catch (error) {
          if (error instanceof Error && error.message.includes('Extension context invalidated')) {
            handleContextInvalidated();
            break;
          }
        } finally {
          processingItems.delete(item);
        }
      }
    }
  };

  const cleanup = adapter.observeItems(handleNewItems);
  
  // Cleanup observer to remove overlays when elements are removed from DOM
  const cleanupObserver = new MutationObserver((mutations) => {
    if (!isExtensionContextValid) return;
    
    // Check all processed items and clean up if their elements are removed
    const itemsToRemove: HTMLElement[] = [];
    processedItems.forEach((item, element) => {
      if (!element.isConnected) {
        // Element was removed from DOM, clean up overlay
        if (item.overlay) {
          // Clean up overlay event listeners
          if ((item.overlay as any).__slopCleanup) {
            (item.overlay as any).__slopCleanup();
          }
          if (item.overlay.parentNode) {
            item.overlay.parentNode.removeChild(item.overlay);
          }
        }
        // Restore element styles if it still exists (might be reattached later)
        if (element.style) {
          element.style.removeProperty('opacity');
          element.style.removeProperty('visibility');
          element.style.removeProperty('pointer-events');
          element.style.removeProperty('position');
        }
        itemsToRemove.push(element);
      } else if (item.overlay && !item.overlay.parentNode) {
        // Overlay was removed but element still exists - mark as showing
        // Clean up listeners if they exist
        if ((item.overlay as any).__slopCleanup) {
          (item.overlay as any).__slopCleanup();
        }
        item.isShowing = true;
        item.overlay = null;
      } else if (item.overlay && item.overlay.parentNode !== element && !item.isShowing) {
        // Overlay is in wrong parent - this shouldn't happen with new approach, but clean up just in case
        if ((item.overlay as any).__slopCleanup) {
          (item.overlay as any).__slopCleanup();
        }
        if (item.overlay.parentNode) {
          item.overlay.parentNode.removeChild(item.overlay);
        }
        itemsToRemove.push(element);
      }
    });
    
    // Remove items from processedItems map
    itemsToRemove.forEach(element => {
      processedItems.delete(element);
    });
    
    // Also clean up any orphaned overlays in the DOM
    // Only remove overlays that are truly orphaned (not in processedItems and not being created)
    document.querySelectorAll('[data-slop-overlay]').forEach((overlay) => {
      const hasMatchingItem = Array.from(processedItems.values()).some(
        item => item.overlay === overlay
      );
      // Only remove if it's truly orphaned - give it some time in case it's being added to processedItems
      if (!hasMatchingItem && overlay.parentNode) {
        // Check if overlay was just created (has a recent timestamp or is still being set up)
        // If overlay has no matching item but was created recently, don't remove it yet
        const overlayAge = (overlay as any).__createdAt || 0;
        const ageInMs = Date.now() - overlayAge;
        // Only remove overlays older than 2 seconds to avoid removing ones being created
        if (ageInMs > 2000) {
          overlay.parentNode.removeChild(overlay);
        }
      }
    });
  });
  
  cleanupObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
  
  
  const hotkeyCleanup = initializeHotkeys(
    adapter,
    async (itemId: string, element: HTMLElement) => {
      // #region agent log
      const logData10 = {location:'content-main.ts:714',message:'onReportSlop called from hotkeys',data:{itemId:itemId,elementTagName:element.tagName,elementClassName:element.className?.substring(0,50),elementIdAttr:element.id?.substring(0,30),isConnected:element.isConnected,timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'}};
      fetch('http://127.0.0.1:7243/ingest/b2719b1f-0fda-42ef-a1bf-85265994e0a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData10)}).catch(()=>{});
      // #endregion
      if (!isExtensionContextValid) return;
      try {
        try {
          await reportSlop(itemId, adapter.getPlatformName());
        } catch (error) {
          // Silently handle errors - context invalidated is already handled
        }
        if (isExtensionContextValid && element && element.isConnected) {
          // Use the specific element that was clicked, not search for all matching items
          // This prevents marking all posts as slop when only one was selected
          await processItem(element, adapter, true).catch(() => {
            // Silently handle errors
          });
        }
      } catch (error) {
        // Silently handle any errors
      }
    },
    reportWebsite
  );

  // Context menu handler for right-click "Report Slop"
  const handleContextMenu = async (e: MouseEvent) => {
    if (!isExtensionContextValid) return;
    
    const target = e.target as HTMLElement;
    
    // Find the post container that contains the right-clicked element
    let postElement: HTMLElement | null = null;
    
    if (adapter.getPlatformName() === 'linkedin') {
      // Use getCurrentItems to find the complete post container
      const allItems = adapter.getCurrentItems();
      for (const potentialItem of allItems) {
        if (potentialItem.tagName === 'MAIN' || potentialItem.id === 'workspace') {
          continue;
        }
        if (potentialItem.contains(target)) {
          postElement = potentialItem;
          break;
        }
      }
      
      // Fallback: walk up DOM tree
      if (!postElement) {
        let current: HTMLElement | null = target;
        let depth = 0;
        while (current && depth < 20) {
          if (current.tagName === 'MAIN' || current.id === 'workspace') {
            current = current.parentElement;
            depth++;
            continue;
          }
          
          const textLength = current.textContent?.length || 0;
          const buttons = current.querySelectorAll('button, [role="button"]');
          const buttonsCount = buttons.length;
          const images = current.querySelectorAll('img');
          const imagesCount = images.length;
          const childrenCount = current.children.length;
          
          const hasEngagementButtons = Array.from(buttons).some(btn => {
            const btnText = (btn.textContent || '').toLowerCase();
            return btnText.includes('like') || btnText.includes('comentar') || 
                   btnText.includes('comment') || btnText.includes('share') ||
                   btnText.includes('compartir') || btnText.includes('recomendar');
          });
          
          const hasProfileImage = Array.from(images).some(img => {
            const alt = (img.getAttribute('alt') || '').toLowerCase();
            return alt.includes('profile') || alt.includes('avatar') || alt.includes('member');
          });
          
          const rect = current.getBoundingClientRect();
          const hasMinimumHeight = rect.height >= 150;
          
          const isPost = 
            textLength >= 50 && textLength <= 5000 &&
            (hasEngagementButtons || hasProfileImage) &&
            (childrenCount >= 2 || imagesCount > 0) &&
            (hasMinimumHeight || depth <= 2) &&
            (current.tagName === 'DIV' || current.tagName === 'SECTION' || current.tagName === 'ARTICLE');
          
          if (isPost) {
            postElement = current;
            break;
          }
          
          current = current.parentElement;
          depth++;
        }
      }
    } else {
      // For other platforms, use the selector
      const selector = adapter.getItemSelector();
      postElement = target.closest(selector) as HTMLElement;
    }
    
    if (postElement) {
      e.preventDefault();
      e.stopPropagation();
      
      const itemId = adapter.getItemId(postElement);
      if (itemId && isExtensionContextValid) {
        try {
          await reportSlop(itemId, adapter.getPlatformName());
          if (isExtensionContextValid && postElement && postElement.isConnected) {
            await processItem(postElement, adapter, true).catch(() => {});
          }
        } catch (error) {
          // Silently handle errors
        }
      }
    }
  };
  
  document.addEventListener('contextmenu', handleContextMenu, true);

  window.addEventListener('beforeunload', () => {
    cleanup();
    cleanupObserver.disconnect();
    hotkeyCleanup();
    document.removeEventListener('contextmenu', handleContextMenu, true);
  });

  // Listen for keyboard commands from service worker
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'KEYBOARD_COMMAND') {
      const command = (message as { command: string }).command;
      
      if (command === 'toggle-trash-mode') {
        // Trigger Alt+S behavior
        const fakeEvent = new KeyboardEvent('keydown', {
          key: 's',
          altKey: true,
          ctrlKey: false,
          metaKey: false,
          bubbles: true,
          cancelable: true,
        });
        document.dispatchEvent(fakeEvent);
      } else if (command === 'report-website') {
        // Trigger Alt+U behavior
        const fakeEvent = new KeyboardEvent('keydown', {
          key: 'u',
          altKey: true,
          ctrlKey: false,
          metaKey: false,
          bubbles: true,
          cancelable: true,
        });
        document.dispatchEvent(fakeEvent);
      }
      sendResponse({ success: true });
      return true;
    }
    return false;
  });
};

// Only run in the main frame, not in iframes or sandboxed frames
// This prevents errors about sandboxed frames trying to execute scripts
try {
  // Check if we're in an iframe or sandboxed frame
  const isInIframe = window.self !== window.top;
  const isAboutBlank = window.location.href === 'about:blank' || window.location.href === 'about:srcdoc';
  
  if (isInIframe || isAboutBlank) {
    // Running in an iframe or sandboxed frame - exit early to prevent errors
    // Content scripts should only run in the main frame
    console.log('[Slop-Stop] Content script skipped: running in iframe or sandboxed frame', {
      isInIframe,
      isAboutBlank,
      location: window.location.href
    });
  } else {
    // Running in main frame - proceed with initialization
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeContentScript);
    } else {
      initializeContentScript();
    }
  }
} catch (error) {
  // If we can't determine the frame context, skip initialization to be safe
  console.warn('[Slop-Stop] Error checking frame context, skipping initialization:', error);
}
