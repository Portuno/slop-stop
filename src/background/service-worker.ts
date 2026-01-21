import { handleMessage } from './message-handler.js';
import { Message, MessageType } from '../shared/types.js';
import { DEFAULT_REPORT_LIMIT_THRESHOLD, STORAGE_KEYS } from '../shared/constants.js';

chrome.runtime.onInstalled.addListener(async () => {
  try {
    console.log('[Slop-Stop] Extension installed');
    
    const settings = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
    if (!settings[STORAGE_KEYS.SETTINGS]) {
      await chrome.storage.sync.set({
        [STORAGE_KEYS.SETTINGS]: {
          reportLimitThreshold: DEFAULT_REPORT_LIMIT_THRESHOLD,
        },
      });
    }

    // Create context menu item
    chrome.contextMenus.create({
      id: 'report-slop',
      title: 'Report Slop',
      contexts: ['page', 'selection', 'link', 'image'],
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Slop-Stop] Error in onInstalled:', errorMessage);
  }
});

chrome.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse) => {
    // Wrap in try-catch to prevent service worker crashes
    try {
      handleMessage(message, sendResponse).catch((error) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[Slop-Stop] Error in message handler:', errorMessage);
        sendResponse({ error: errorMessage });
      });
      return true; // Keep channel open for async response
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Slop-Stop] Synchronous error in message listener:', errorMessage);
      sendResponse({ error: errorMessage });
      return true;
    }
  }
);

// Helper function to check if a URL is a valid web page
const isValidWebPage = (url: string | undefined): boolean => {
  if (!url) return false;
  // Exclude Chrome internal pages and extension pages
  return !url.startsWith('chrome://') && 
         !url.startsWith('chrome-extension://') && 
         !url.startsWith('edge://') &&
         !url.startsWith('about:') &&
         (url.startsWith('http://') || url.startsWith('https://'));
};

// Handle keyboard commands
chrome.commands.onCommand.addListener((command) => {
  try {
    // Get the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      try {
        const tab = tabs[0];
        if (!tab?.id) {
          return;
        }

        // Check if the tab URL is a valid web page
        if (!isValidWebPage(tab.url)) {
          // Silently skip Chrome internal pages and extension pages
          return;
        }

        chrome.tabs.sendMessage(tab.id, {
          type: 'KEYBOARD_COMMAND',
          command: command,
        }).catch((error) => {
          const errorMessage = error instanceof Error ? error.message : String(error);
          // Only log unexpected errors - "Receiving end does not exist" is expected
          // when content script isn't available (e.g., page still loading, script failed to inject)
          if (!errorMessage.includes('Receiving end does not exist') && 
              !errorMessage.includes('Could not establish connection')) {
            console.error('[Slop-Stop] Error sending command to content script:', errorMessage);
          }
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[Slop-Stop] Error in command handler:', errorMessage);
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Slop-Stop] Error in onCommand listener:', errorMessage);
  }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  try {
    if (info.menuItemId === 'report-slop' && tab?.id) {
      // Check if the tab URL is a valid web page
      if (!isValidWebPage(tab.url)) {
        return;
      }

      chrome.tabs.sendMessage(tab.id, {
        type: MessageType.CONTEXT_MENU_REPORT_SLOP,
      }).catch((error) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        // Only log unexpected errors
        if (!errorMessage.includes('Receiving end does not exist') && 
            !errorMessage.includes('Could not establish connection')) {
          console.error('[Slop-Stop] Error sending context menu command to content script:', errorMessage);
        }
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Slop-Stop] Error in context menu handler:', errorMessage);
  }
});
