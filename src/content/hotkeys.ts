import { createConfirmationModal, removeConfirmationModal } from './confirmation-modal';
import { MessageType } from '../shared/types';
import { PlatformAdapter } from '../shared/types';

export interface HotkeyState {
  isTrashMode: boolean;
  currentModal: HTMLElement | null;
}

let hotkeyState: HotkeyState = {
  isTrashMode: false,
  currentModal: null,
};

export const initializeHotkeys = (
  adapter: PlatformAdapter,
  onReportSlop: (itemId: string, element: HTMLElement) => Promise<void>,
  onReportWebsite: () => Promise<{ shouldBlock: boolean }>
): () => void => {
  const handleKeyDown = async (e: KeyboardEvent) => {
    if (e.altKey && e.key === 's' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      toggleTrashMode(adapter, onReportSlop);
    } else if (e.altKey && e.key === 'u' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      await handleReportWebsite(onReportWebsite);
    }
  };

  // Use capture phase to intercept before LinkedIn handles it
  document.addEventListener('keydown', handleKeyDown, true);

  return () => {
    document.removeEventListener('keydown', handleKeyDown, true);
    exitTrashMode();
  };
};

const toggleTrashMode = (
  adapter: PlatformAdapter,
  onReportSlop: (itemId: string, element: HTMLElement) => Promise<void>
): void => {
  if (hotkeyState.isTrashMode) {
    exitTrashMode();
  } else {
    enterTrashMode(adapter, onReportSlop);
  }
};

const enterTrashMode = (
  adapter: PlatformAdapter,
  onReportSlop: (itemId: string, element: HTMLElement) => Promise<void>
): void => {
  hotkeyState.isTrashMode = true;
  document.body.classList.add('slop-trash-cursor');

  const handleClick = async (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    
    // #region agent log
    const logData1 = {location:'hotkeys.ts:57',message:'handleClick called',data:{targetTagName:target.tagName,targetClassName:target.className?.substring(0,50),targetId:target.id?.substring(0,30),platform:adapter.getPlatformName(),timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'}};
    fetch('http://127.0.0.1:7243/ingest/b2719b1f-0fda-42ef-a1bf-85265994e0a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData1)}).catch(()=>{});
    // #endregion
    
    const selector = adapter.getItemSelector();
    
    // For LinkedIn, prioritize finding individual posts, not the feed container
    // Start by looking for the most specific selectors first
    let item: HTMLElement | null = null;
    
    if (adapter.getPlatformName() === 'linkedin') {
      // LinkedIn: First try to use getCurrentItems to find the complete post container
      // This ensures we get the full post, not just sub-elements
      const allItems = adapter.getCurrentItems();
      
      // #region agent log
      const logData4 = {location:'hotkeys.ts:71',message:'Using getCurrentItems for LinkedIn',data:{allItemsCount:allItems.length,targetTagName:target.tagName,timestamp:Date.now(),sessionId:'debug-session',runId:'run6',hypothesisId:'E'}};
      fetch('http://127.0.0.1:7243/ingest/b2719b1f-0fda-42ef-a1bf-85265994e0a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData4)}).catch(()=>{});
      // #endregion
      
      // Find which post container contains the click target
      for (const potentialItem of allItems) {
        // Skip if it's the main feed container
        if (potentialItem.tagName === 'MAIN' || potentialItem.id === 'workspace') {
          continue;
        }
        
        // Check if target is inside this potential post
        if (potentialItem.contains(target)) {
          item = potentialItem;
          
          // #region agent log
          const logData5 = {location:'hotkeys.ts:87',message:'Found item by getCurrentItems',data:{itemTagName:item.tagName,itemClassName:item.className?.substring(0,50),itemId:item.id?.substring(0,30),textLength:item.textContent?.length,timestamp:Date.now(),sessionId:'debug-session',runId:'run6',hypothesisId:'E'}};
          fetch('http://127.0.0.1:7243/ingest/b2719b1f-0fda-42ef-a1bf-85265994e0a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData5)}).catch(()=>{});
          // #endregion
          
          break;
        }
      }
      
      // Fallback: Walk up the DOM tree if getCurrentItems didn't find anything
      if (!item) {
        let current: HTMLElement | null = target;
        let depth = 0;
        
        while (current && depth < 20) {
          // Skip if it's the main feed container
          if (current.tagName === 'MAIN' || current.id === 'workspace') {
            current = current.parentElement;
            depth++;
            continue;
          }
          
          // Check if current element looks like a post using structure-based criteria
          const textLength = current.textContent?.length || 0;
          const buttons = current.querySelectorAll('button, [role="button"]');
          const buttonsCount = buttons.length;
          const images = current.querySelectorAll('img');
          const imagesCount = images.length;
          const childrenCount = current.children.length;
          
          // Check for LinkedIn-specific engagement buttons
          const hasEngagementButtons = Array.from(buttons).some(btn => {
            const btnText = (btn.textContent || '').toLowerCase();
            return btnText.includes('like') || btnText.includes('comentar') || 
                   btnText.includes('comment') || btnText.includes('share') ||
                   btnText.includes('compartir') || btnText.includes('recomendar');
          });
          
          // Check for profile images
          const hasProfileImage = Array.from(images).some(img => {
            const alt = (img.getAttribute('alt') || '').toLowerCase();
            return alt.includes('profile') || alt.includes('avatar') || alt.includes('member');
          });
          
          const rect = current.getBoundingClientRect();
          const hasMinimumHeight = rect.height >= 150;
          
          // Post characteristics matching adapter logic
          const isPost = 
            textLength >= 50 && textLength <= 5000 &&
            (hasEngagementButtons || hasProfileImage) &&
            (childrenCount >= 2 || imagesCount > 0) &&
            (hasMinimumHeight || depth <= 2) &&
            (current.tagName === 'DIV' || current.tagName === 'SECTION' || current.tagName === 'ARTICLE');
          
          if (isPost) {
            item = current;
            
            // #region agent log
            const logData2 = {location:'hotkeys.ts:130',message:'Found item by DOM walk (fallback)',data:{itemTagName:item.tagName,itemClassName:item.className?.substring(0,50),itemId:item.id?.substring(0,30),textLength:textLength,buttonsCount:buttonsCount,hasEngagementButtons:hasEngagementButtons,depth:depth,timestamp:Date.now(),sessionId:'debug-session',runId:'run6',hypothesisId:'E'}};
            fetch('http://127.0.0.1:7243/ingest/b2719b1f-0fda-42ef-a1bf-85265994e0a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData2)}).catch(()=>{});
            // #endregion
            
            break;
          }
          
          current = current.parentElement;
          depth++;
        }
      }
    } else {
      // For other platforms, use the original logic
      item = target.closest(selector) as HTMLElement;
      
      // If selector is compound, try each part
      if (!item && selector.includes(',')) {
        const selectors = selector.split(',').map(s => s.trim());
        for (const sel of selectors) {
          item = target.closest(sel) as HTMLElement;
          if (item) break;
        }
      }
    }

    if (item) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const itemId = adapter.getItemId(item);
      
      // #region agent log
      const logData3 = {location:'hotkeys.ts:173',message:'Item found, checking itemId',data:{itemFound:true,itemId:itemId,itemTagName:item.tagName,itemClassName:item.className?.substring(0,50),itemIdAttr:item.id?.substring(0,30),targetTagName:target.tagName,timestamp:Date.now(),sessionId:'debug-session',runId:'run4',hypothesisId:'E'}};
      fetch('http://127.0.0.1:7243/ingest/b2719b1f-0fda-42ef-a1bf-85265994e0a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData3)}).catch(()=>{});
      // #endregion
      
      if (!itemId) {
        // #region agent log
        const logDataNoId = {location:'hotkeys.ts:181',message:'No itemId found for clicked item',data:{itemTagName:item.tagName,itemClassName:item.className?.substring(0,50),targetTagName:target.tagName,timestamp:Date.now(),sessionId:'debug-session',runId:'run4',hypothesisId:'E'}};
        fetch('http://127.0.0.1:7243/ingest/b2719b1f-0fda-42ef-a1bf-85265994e0a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logDataNoId)}).catch(()=>{});
        // #endregion
        return;
      }

      // #region agent log
      const logDataModal = {location:'hotkeys.ts:186',message:'Creating confirmation modal',data:{itemId:itemId,itemTagName:item.tagName,timestamp:Date.now(),sessionId:'debug-session',runId:'run4',hypothesisId:'E'}};
      fetch('http://127.0.0.1:7243/ingest/b2719b1f-0fda-42ef-a1bf-85265994e0a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logDataModal)}).catch(()=>{});
      // #endregion
      
      const modal = createConfirmationModal({
        message: 'Mark as SLOP?',
        onConfirm: async () => {
          removeConfirmationModal(modal);
          // Report to backend and trigger Ghost Container UI - pass the specific element
          await onReportSlop(itemId, item);
          exitTrashMode();
        },
        onCancel: () => {
          removeConfirmationModal(modal);
          exitTrashMode();
        },
      });

      hotkeyState.currentModal = modal;
      document.body.appendChild(modal);
    } else {
      // #region agent log
      const logDataNoItem = {location:'hotkeys.ts:201',message:'No item found for click',data:{targetTagName:target.tagName,targetClassName:target.className?.substring(0,50),targetId:target.id?.substring(0,30),platform:adapter.getPlatformName(),timestamp:Date.now(),sessionId:'debug-session',runId:'run4',hypothesisId:'E'}};
      fetch('http://127.0.0.1:7243/ingest/b2719b1f-0fda-42ef-a1bf-85265994e0a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logDataNoItem)}).catch(()=>{});
      // #endregion
    }
  };

  document.addEventListener('click', handleClick, true);

  const cleanup = () => {
    document.removeEventListener('click', handleClick, true);
  };

  (window as unknown as { __slopTrashCleanup?: () => void }).__slopTrashCleanup = cleanup;
};

const exitTrashMode = (): void => {
  hotkeyState.isTrashMode = false;
  document.body.classList.remove('slop-trash-cursor');

  if (hotkeyState.currentModal) {
    removeConfirmationModal(hotkeyState.currentModal);
    hotkeyState.currentModal = null;
  }

  const cleanup = (window as unknown as { __slopTrashCleanup?: () => void }).__slopTrashCleanup;
  if (cleanup) {
    cleanup();
    delete (window as unknown as { __slopTrashCleanup?: () => void }).__slopTrashCleanup;
  }
};

const handleReportWebsite = async (
  onReportWebsite: () => Promise<{ shouldBlock: boolean }>
): Promise<void> => {
  const modal = createConfirmationModal({
    message: 'Mark this website as SLOP?',
    onConfirm: async () => {
      removeConfirmationModal(modal);
      const result = await onReportWebsite();

      if (result.shouldBlock) {
        showWebsiteBlockModal();
      }
    },
    onCancel: () => {
      removeConfirmationModal(modal);
    },
  });

  hotkeyState.currentModal = modal;
  document.body.appendChild(modal);
};

const showWebsiteBlockModal = (): void => {
  const overlay = document.createElement('div');
  overlay.className = 'slop-website-block-modal';

  const content = document.createElement('div');
  content.className = 'slop-website-block-content';

  const title = document.createElement('h2');
  title.className = 'slop-website-block-title';
  title.textContent = 'Website Marked as Slop';

  const message = document.createElement('p');
  message.className = 'slop-website-block-message';
  message.textContent =
    'This website has been flagged by the community as containing slop content. You can return to safety or continue anyway.';

  const buttons = document.createElement('div');
  buttons.className = 'slop-website-block-buttons';

  const returnButton = document.createElement('button');
  returnButton.className = 'slop-website-block-button slop-website-block-return';
  returnButton.textContent = 'Return';
  returnButton.addEventListener('click', () => {
    window.history.back();
    overlay.remove();
  });

  const continueButton = document.createElement('button');
  continueButton.className = 'slop-website-block-button slop-website-block-continue';
  continueButton.textContent = 'Continue Anyway';
  continueButton.addEventListener('click', () => {
    overlay.remove();
  });

  buttons.appendChild(returnButton);
  buttons.appendChild(continueButton);

  content.appendChild(title);
  content.appendChild(message);
  content.appendChild(buttons);
  overlay.appendChild(content);

  document.body.appendChild(overlay);
};
