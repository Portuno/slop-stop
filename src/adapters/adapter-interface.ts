import { Platform, PlatformAdapter } from '../shared/types';

export abstract class BaseAdapter implements PlatformAdapter {
  abstract getItemId(element: HTMLElement): string | null;
  abstract getItemSelector(): string;
  abstract getPlatformName(): Platform;
  abstract canHandleUrl(url: string): boolean;

  observeItems(callback: (items: HTMLElement[]) => void): () => void {
    
    let lastItemsCount = 0;
    let checkCount = 0;
    const maxChecks = 20; // For LinkedIn, check more times as content loads
    const processedItemSet = new WeakSet<HTMLElement>();
    let debounceTimer: number | null = null;
    const DEBOUNCE_MS = 300; // Debounce callback calls to prevent excessive processing
    
    const checkForItems = () => {
      const items = this.getCurrentItems();
      
      // Filter out items that have already been processed
      const newItems = items.filter(item => !processedItemSet.has(item));
      
      // Only call callback if:
      // 1. We found new items (not in processedItemSet) - this is the main condition
      // 2. It's the first check (checkCount === 0) and we have items
      // Do NOT call callback just because count changed - this causes infinite loops
      const countChanged = items.length !== lastItemsCount;
      const shouldCallCallback = items.length > 0 && (
        newItems.length > 0 || 
        checkCount === 0
      );
      
      if (shouldCallCallback) {
        // Clear existing debounce timer
        if (debounceTimer !== null) {
          clearTimeout(debounceTimer);
        }
        
        // Debounce the callback to prevent excessive calls
        debounceTimer = window.setTimeout(() => {
          // Mark all items as processed in WeakSet (but content script will track actual processing)
          items.forEach(item => processedItemSet.add(item));
          lastItemsCount = items.length;
          try {
            callback(items); // Pass all items so they get processed
          } catch (error) {
            console.error('[Slop-Stop] Error in callback:', error);
          }
          debounceTimer = null;
        }, DEBOUNCE_MS);
      }
      
      // For LinkedIn, keep checking for a while as content loads dynamically
      if (this.getPlatformName() === 'linkedin' && checkCount < maxChecks) {
        checkCount++;
        setTimeout(checkForItems, 500);
      }
    };
    
    const observer = new MutationObserver(() => {
      checkForItems();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Initial check
    const initialItems = this.getCurrentItems();
    
    if (initialItems.length > 0) {
      initialItems.forEach(item => processedItemSet.add(item));
      lastItemsCount = initialItems.length;
      callback(initialItems);
    } else if (this.getPlatformName() === 'linkedin') {
      // For LinkedIn, start delayed checking
      setTimeout(checkForItems, 1000);
    }

    return () => observer.disconnect();
  }

  protected getCurrentItems(): HTMLElement[] {
    const selector = this.getItemSelector();
    return Array.from(document.querySelectorAll<HTMLElement>(selector));
  }

  createGhostContainer(originalElement: HTMLElement): HTMLElement {
    const ghost = originalElement.cloneNode(true) as HTMLElement;
    ghost.style.visibility = 'hidden';
    ghost.style.pointerEvents = 'none';
    
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
    
    const container = document.createElement('div');
    container.style.position = 'relative';
    container.style.width = `${rect.width}px`;
    container.style.height = `${rect.height}px`;
    container.appendChild(ghost);
    container.appendChild(overlay);
    
    return container;
  }
}
