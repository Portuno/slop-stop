import { createConfirmationModal, removeConfirmationModal } from './confirmation-modal';
import { MessageType } from '../shared/types';
import { PlatformAdapter } from '../shared/types';
import { findLinkedInPostContainer } from './linkedin-post-finder';

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
  onReportWebsite: () => Promise<{ shouldBlock: boolean; reportCount: number }>
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
    
    // For LinkedIn, prioritize finding individual posts, not the feed container.
    let item: HTMLElement | null = null;
    
    if (adapter.getPlatformName() === 'linkedin') {
      item = findLinkedInPostContainer(target, adapter);
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
  onReportWebsite: () => Promise<{ shouldBlock: boolean; reportCount: number }>
): Promise<void> => {
  const modal = createConfirmationModal({
    message: 'Mark this website as SLOP?',
    onConfirm: async () => {
      removeConfirmationModal(modal);
      const result = await onReportWebsite();

      if (result.shouldBlock) {
        showWebsiteBlockModal(result.reportCount);
      }
    },
    onCancel: () => {
      removeConfirmationModal(modal);
    },
  });

  hotkeyState.currentModal = modal;
  document.body.appendChild(modal);
};

const showWebsiteBlockModal = (reportCount: number): void => {
  const overlay = document.createElement('div');
  overlay.className = 'slop-website-block-modal';

  // Radial gradient overlay layer
  const gradientOverlay = document.createElement('div');
  gradientOverlay.className = 'slop-website-block-gradient';

  const content = document.createElement('div');
  content.className = 'slop-website-block-content';

  // Warning icon
  const iconContainer = document.createElement('div');
  iconContainer.className = 'slop-website-block-icon';
  iconContainer.innerHTML = '⚠️';
  iconContainer.setAttribute('aria-hidden', 'true');

  const title = document.createElement('h2');
  title.className = 'slop-website-block-title';
  title.textContent = 'Access Restricted: Community-Flagged Slop';

  const message = document.createElement('p');
  message.className = 'slop-website-block-message';
  message.textContent =
    'Human curators have identified this entire website as a primary source of filler or low-quality content.';

  // Report counter badge
  const counterBadge = document.createElement('div');
  counterBadge.className = 'slop-website-block-counter';
  counterBadge.textContent = `[${reportCount}] Humans have flagged this domain as Slop`;

  const buttons = document.createElement('div');
  buttons.className = 'slop-website-block-buttons';

  const returnButton = document.createElement('button');
  returnButton.className = 'slop-website-block-button slop-website-block-return';
  returnButton.textContent = 'Take me back to safety';
  returnButton.setAttribute('aria-label', 'Return to previous page');
  returnButton.setAttribute('tabindex', '0');
  
  const handleReturn = () => {
    window.history.back();
    overlay.remove();
  };
  
  returnButton.addEventListener('click', handleReturn);
  returnButton.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleReturn();
    }
  });

  const continueButton = document.createElement('button');
  continueButton.className = 'slop-website-block-button slop-website-block-continue';
  continueButton.textContent = 'Continue anyway';
  continueButton.setAttribute('aria-label', 'Continue to website anyway');
  continueButton.setAttribute('tabindex', '0');
  
  const handleContinue = () => {
    overlay.remove();
  };
  
  continueButton.addEventListener('click', handleContinue);
  continueButton.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleContinue();
    }
  });

  buttons.appendChild(returnButton);
  buttons.appendChild(continueButton);

  content.appendChild(iconContainer);
  content.appendChild(title);
  content.appendChild(message);
  content.appendChild(counterBadge);
  content.appendChild(buttons);
  
  overlay.appendChild(gradientOverlay);
  overlay.appendChild(content);

  document.body.appendChild(overlay);
  
  // Prevent scrolling and interaction with background
  document.body.style.overflow = 'hidden';
  
  // Cleanup on remove
  const observer = new MutationObserver(() => {
    if (!overlay.isConnected) {
      document.body.style.overflow = '';
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true });
};
