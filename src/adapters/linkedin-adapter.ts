import { BaseAdapter } from './adapter-interface';
import { Platform } from '../shared/types';
import { PLATFORM_DOMAINS } from '../shared/constants';

export class LinkedInAdapter extends BaseAdapter {
  getPlatformName(): Platform {
    return 'linkedin';
  }

  canHandleUrl(url: string): boolean {
    const hostname = new URL(url).hostname.toLowerCase();
    return PLATFORM_DOMAINS.linkedin.some(domain => hostname.includes(domain));
  }

  getItemSelector(): string {
    // LinkedIn has obfuscated classes and removed data-urn/data-id attributes
    // Use structure-based selectors that don't rely on obfuscated class names
    // Target elements that are likely posts based on their role and structure
    return '[role="article"], [role="region"][aria-label*="Post"], [role="region"][aria-label*="post"], div[data-test-id*="activity"], div[data-test-id*="feed"], section[class*="update"], section[class*="post"]';
  }
  
  protected getCurrentItems(): HTMLElement[] {
    // LinkedIn has obfuscated classes and removed data-urn/data-id attributes
    // Use structure-based detection that doesn't rely on obfuscated class names
    
    // Try multiple strategies to find the main feed container
    let mainFeed: HTMLElement | null = null;
    
    // Strategy 1: Look for main#workspace (original selector)
    mainFeed = document.querySelector('main#workspace') as HTMLElement;
    
    // Strategy 2: Look for any main element with id="workspace"
    if (!mainFeed) {
      const allMains = Array.from(document.querySelectorAll('main'));
      mainFeed = allMains.find(m => m.id === 'workspace') as HTMLElement || null;
    }
    
    // Strategy 3: Look for any main element
    if (!mainFeed) {
      mainFeed = document.querySelector('main') as HTMLElement;
    }
    
    // Strategy 4: Look for body as last resort
    if (!mainFeed) {
      mainFeed = document.body;
      console.warn('[Slop-Stop] main#workspace not found, using document.body as fallback');
    }
    
    // #region agent log
    const logDataMainFeed = {
      location: 'linkedin-adapter.ts:26',
      message: 'Main feed container search',
      data: {
        mainFeedFound: !!mainFeed,
        mainFeedTag: mainFeed?.tagName,
        mainFeedId: mainFeed?.id,
        mainFeedClassName: mainFeed?.className?.substring(0, 100),
        allMainsCount: document.querySelectorAll('main').length,
        bodyChildrenCount: document.body.children.length,
        url: window.location.href
      },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'run4',
      hypothesisId: 'D'
    };
    fetch('http://127.0.0.1:7243/ingest/b2719b1f-0fda-42ef-a1bf-85265994e0a0', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logDataMainFeed)
    }).catch(() => {});
    // #endregion
    
    if (!mainFeed) {
      console.warn('[Slop-Stop] Could not find main feed container');
      return [];
    }
    
    // Try multiple ways to find the scroll container
    let scrollContainer: HTMLElement | null = null;
    const scrollContainerSelectors = [
      '.scaffold-finite-scroll__content',
      '[class*="scaffold-finite-scroll"]',
      'div[class*="scroll"]'
    ];
    
    for (const selector of scrollContainerSelectors) {
      const found = mainFeed.querySelector(selector);
      if (found) {
        scrollContainer = found as HTMLElement;
        // logger.log(`[Slop-Stop] Found scroll container using selector: ${selector}`);
        break;
      }
    }
    
    // If no scroll container found, search more deeply in main#workspace
    if (!scrollContainer) {
      // Look for divs with scroll-related classes or styles deeper in the DOM
      const allDivs = Array.from(mainFeed.querySelectorAll('div'));
      for (const div of allDivs) {
        const className = div.className || '';
        const style = div.getAttribute('style') || '';
        if (className.includes('scroll') || className.includes('feed') || 
            style.includes('overflow') && style.includes('auto')) {
          // Check if this div has multiple children (likely the scroll container)
          if (div.children.length > 5) {
            scrollContainer = div;
            console.log(`[Slop-Stop] Found scroll container by deep search: ${className.substring(0, 50)}`);
            break;
          }
        }
      }
    }
    
    // If still no scroll container found, use main#workspace directly
    if (!scrollContainer) {
      scrollContainer = mainFeed as HTMLElement;
      // logger.log('[Slop-Stop] Using main#workspace as scroll container');
    }
    
    const allItems: HTMLElement[] = [];
    const seen = new Set<HTMLElement>();
    
    // Strategy: Find all divs/sections within scroll container and filter by post characteristics
    // But skip the scroll container itself and its immediate children if they're too large
    const candidateElements = Array.from(scrollContainer.querySelectorAll('div, section, article'));
    // logger.log(`[Slop-Stop] Found ${candidateElements.length} candidate elements in scroll container`);
    
    // Sort candidates by size (largest first) to detect parent containers before children
    // This helps ensure we find the full post container, not just sub-elements
    const sortedCandidates = candidateElements
      .map(el => ({
        element: el as HTMLElement,
        size: (el.textContent?.length || 0) + (el.children.length * 100) + (el.querySelectorAll('button, [role="button"]').length * 50)
      }))
      .sort((a, b) => b.size - a.size)
      .map(item => item.element);
    
    // #region agent log
    const logDataStart = {
      location: 'linkedin-adapter.ts:50',
      message: 'Starting structure-based detection',
      data: {
        candidateElementsCount: candidateElements.length,
        sortedCandidatesCount: sortedCandidates.length,
        scrollContainerFound: !!scrollContainer,
        scrollContainerTag: scrollContainer?.tagName
      },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'run4',
      hypothesisId: 'D'
    };
    fetch('http://127.0.0.1:7243/ingest/b2719b1f-0fda-42ef-a1bf-85265994e0a0', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logDataStart)
    }).catch(() => {});
    // #endregion
    
    for (const htmlEl of sortedCandidates) {
      // Skip if already seen (or if it's a descendant of an already-detected post)
      if (seen.has(htmlEl)) continue;
      
      // Skip if it's the scroll container itself or main#workspace
      if (htmlEl === scrollContainer || htmlEl === mainFeed || htmlEl.tagName === 'MAIN') {
        continue;
      }
      
      // Skip if this element is a descendant of any already-detected post
      let isDescendantOfPost = false;
      for (const existingItem of allItems) {
        if (existingItem.contains(htmlEl)) {
          isDescendantOfPost = true;
          break;
        }
      }
      if (isDescendantOfPost) {
        seen.add(htmlEl); // Mark as seen to avoid checking again
        continue;
      }
      
      // Post detection criteria (structure-based, not class-based)
      // STRICT: Only detect elements that have ALL characteristics of a COMPLETE post
      const textLength = htmlEl.textContent?.length || 0;
      const buttons = htmlEl.querySelectorAll('button, [role="button"]');
      const buttonsCount = buttons.length;
      const images = htmlEl.querySelectorAll('img');
      const imagesCount = images.length;
      const childrenCount = htmlEl.children.length;
      
      // Check for LinkedIn-specific engagement buttons (like, comment, share)
      // A COMPLETE post MUST have engagement buttons
      const hasEngagementButtons = Array.from(buttons).some(btn => {
        const btnText = (btn.textContent || '').toLowerCase();
        return btnText.includes('like') || btnText.includes('comentar') || 
               btnText.includes('comment') || btnText.includes('share') ||
               btnText.includes('compartir') || btnText.includes('recomendar');
      });
      
      // Check for profile images (posts usually have profile pictures)
      const hasProfileImage = Array.from(images).some(img => {
        const alt = (img.getAttribute('alt') || '').toLowerCase();
        return alt.includes('profile') || alt.includes('avatar') || alt.includes('member');
      });
      
      // Check if element has minimum visual height (posts are usually tall)
      const rect = htmlEl.getBoundingClientRect();
      const hasMinimumHeight = rect.height >= 150; // Posts are usually at least 150px tall
      
      // Check if element is a direct child of scroll container or close to it (top-level posts)
      // This helps avoid detecting nested sub-elements
      let isTopLevel = false;
      let parent = htmlEl.parentElement;
      let depth = 0;
      while (parent && depth < 5) {
        if (parent === scrollContainer) {
          isTopLevel = depth <= 2; // Direct child or grandchild of scroll container
          break;
        }
        parent = parent.parentElement;
        depth++;
      }
      
      // Balanced Post characteristics - detect complete posts but allow some flexibility:
      // 1. Has reasonable content (50-5000 chars)
      // 2. Has engagement buttons OR profile image (strong indicator)
      // 3. Has structure (children OR images)
      // 4. Has minimum visual height OR is top-level (is substantial)
      // 5. Is top-level in DOM hierarchy (avoids nested elements)
      const isPost = 
        textLength >= 50 && textLength <= 5000 && // Reasonable content size
        (hasEngagementButtons || hasProfileImage) && // Has engagement buttons OR profile image
        (childrenCount >= 2 || imagesCount > 0) && // Has structure
        (hasMinimumHeight || isTopLevel) && // Has minimum height OR is top-level
        isTopLevel && // Is top-level in DOM hierarchy (required to avoid nested)
        (htmlEl.tagName === 'DIV' || htmlEl.tagName === 'SECTION' || htmlEl.tagName === 'ARTICLE'); // Valid container
      
      if (isPost) {
        // Check if this post contains any already-detected posts (shouldn't happen with sorted order, but double-check)
        const nestedPosts: HTMLElement[] = [];
        for (const existingItem of allItems) {
          if (htmlEl.contains(existingItem)) {
            nestedPosts.push(existingItem);
          }
        }
        
        // Remove nested posts (they're children of this larger post)
        for (const nestedPost of nestedPosts) {
          const index = allItems.indexOf(nestedPost);
          if (index !== -1) {
            allItems.splice(index, 1);
            seen.delete(nestedPost);
          }
        }
        
        // Mark this element and ALL its descendants as seen to avoid detecting them as separate posts
        seen.add(htmlEl);
        const allDescendants = htmlEl.querySelectorAll('div, section, article');
        allDescendants.forEach(desc => seen.add(desc as HTMLElement));
        
        allItems.push(htmlEl);
        
        // Debug logging disabled in production
        // logger.log(`[Slop-Stop] Found post by structure:`, {
        //   tagName: htmlEl.tagName,
        //   className: htmlEl.className?.substring(0, 100),
        //   textLength,
        //   buttonsCount,
        //   imagesCount,
        //   hasEngagementButtons,
        //   hasProfileImage,
        //   descendantsMarked: allDescendants.length
        // });
        
        // #region agent log
        const logDataPost = {
          location: 'linkedin-adapter.ts:110',
          message: 'Found post by structure',
          data: {
            tagName: htmlEl.tagName,
            className: htmlEl.className?.substring(0, 100),
            textLength: textLength,
            buttonsCount: buttonsCount,
            imagesCount: imagesCount,
            hasEngagementButtons: hasEngagementButtons,
            hasProfileImage: hasProfileImage,
            hasMinimumHeight: hasMinimumHeight,
            isTopLevel: isTopLevel,
            depth: depth,
            height: rect.height,
            descendantsMarked: allDescendants.length,
            nestedPostsRemoved: nestedPosts.length
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run5',
          hypothesisId: 'D'
        };
        fetch('http://127.0.0.1:7243/ingest/b2719b1f-0fda-42ef-a1bf-85265994e0a0', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(logDataPost)
        }).catch(() => {});
        // #endregion
      }
    }
    
    // If we found posts, return them
    if (allItems.length > 0) {
      // logger.log(`[Slop-Stop] Found ${allItems.length} posts using structure-based detection`);
      
    // #region agent log
    const logDataReturn = {
      location: 'linkedin-adapter.ts:125',
      message: 'getCurrentItems returning (structure-based)',
      data: {
        itemsCount: allItems.length,
        items: allItems.slice(0, 5).map(el => ({
          tagName: el.tagName,
          className: el.className?.substring(0, 50),
          id: el.id?.substring(0, 30),
          textLength: el.textContent?.length,
          buttonsCount: el.querySelectorAll('button, [role="button"]').length,
          imagesCount: el.querySelectorAll('img').length,
          childrenCount: el.children.length
        }))
      },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'run4',
      hypothesisId: 'D'
    };
      fetch('http://127.0.0.1:7243/ingest/b2719b1f-0fda-42ef-a1bf-85265994e0a0', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logDataReturn)
      }).catch(() => {});
      // #endregion
      
      return allItems;
    }
    
    // Fallback: Use aggressive DOM inspection as last resort
    // logger.log('[Slop-Stop] No posts found with structure-based detection, using aggressive fallback...');
    
    // #region agent log
    const logDataFallback = {
      location: 'linkedin-adapter.ts:135',
      message: 'Starting aggressive fallback',
      data: {
        timestamp: Date.now()
      },
      sessionId: 'debug-session',
      runId: 'run3',
      hypothesisId: 'P'
    };
    fetch('http://127.0.0.1:7243/ingest/b2719b1f-0fda-42ef-a1bf-85265994e0a0', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logDataFallback)
    }).catch(() => {});
    // #endregion
    
    // Search all elements in main#workspace for posts by content analysis
    const allMainChildren = Array.from(mainFeed.querySelectorAll('*')).slice(0, 1000);
    const potentialPosts: Array<{element: HTMLElement, reason: string, data: any}> = [];
    
    allMainChildren.forEach((el) => {
      const htmlEl = el as HTMLElement;
      
      // Skip if it's the main feed container
      if (htmlEl.tagName === 'MAIN' || htmlEl.id === 'workspace') {
        return;
      }
      
      const text = htmlEl.textContent || '';
      const textLength = text.length;
      const buttons = htmlEl.querySelectorAll('button, [role="button"]');
      const buttonsCount = buttons.length;
      const images = htmlEl.querySelectorAll('img');
      const imagesCount = images.length;
      
      // Look for LinkedIn-specific engagement buttons
      const hasEngagementButtons = Array.from(buttons).some(btn => {
        const btnText = (btn.textContent || '').toLowerCase();
        return btnText.includes('like') || btnText.includes('comentar') || 
               btnText.includes('comment') || btnText.includes('share') ||
               btnText.includes('compartir') || btnText.includes('recomendar') ||
               btnText.includes('follow') || btnText.includes('connect');
      });
      
      // Check for profile images
      const hasProfileImage = Array.from(images).some(img => {
        const alt = (img.getAttribute('alt') || '').toLowerCase();
        return alt.includes('profile') || alt.includes('avatar') || alt.includes('member');
      });
      
      // STRICT Post detection for fallback: must have ALL characteristics of complete post
      const rect = htmlEl.getBoundingClientRect();
      const hasMinimumHeight = rect.height >= 150;
      
      // Check if element is top-level
      let isTopLevel = false;
      let parent = htmlEl.parentElement;
      let depth = 0;
      while (parent && depth < 5) {
        if (parent === mainFeed || parent === scrollContainer) {
          isTopLevel = depth <= 2;
          break;
        }
        parent = parent.parentElement;
        depth++;
      }
      
      // Post detection: reasonable size, has buttons, has LinkedIn indicators, is top-level
      // Balanced criteria matching main detection logic
      const isPost = 
        textLength >= 50 && textLength <= 5000 &&
        (hasEngagementButtons || hasProfileImage) &&
        (htmlEl.children.length >= 2 || imagesCount > 0) &&
        (hasMinimumHeight || isTopLevel) &&
        isTopLevel &&
        (htmlEl.tagName === 'DIV' || htmlEl.tagName === 'SECTION' || htmlEl.tagName === 'ARTICLE');
      
      if (isPost) {
        // Find the top-level post container (walk up the tree)
        let container = htmlEl;
        let parent = htmlEl.parentElement;
        let depth = 0;
        
        while (parent && depth < 5 && parent !== mainFeed) {
          const parentTextLength = (parent.textContent || '').length;
          const parentButtons = parent.querySelectorAll('button, [role="button"]').length;
          
          // If parent also looks like a post container and is not too large, use it
          if (parentButtons >= 2 && parentTextLength >= 50 && parentTextLength <= 3000) {
            container = parent as HTMLElement;
          } else if (parentTextLength > 3000) {
            // Parent is too large, stop here
            break;
          }
          parent = parent.parentElement;
          depth++;
        }
        
        // Final validation
        if (container.tagName === 'MAIN' || container.id === 'workspace') {
          return;
        }
        
        const containerTextLength = container.textContent?.length || 0;
        if (containerTextLength < 50 || containerTextLength > 3000) {
          return;
        }
        
        potentialPosts.push({
          element: container,
          reason: hasEngagementButtons ? 'hasEngagementButtons' : (hasProfileImage ? 'hasProfileImage' : 'isSubstantialContainer'),
          data: {
            tagName: container.tagName,
            className: container.className?.substring(0, 150) || '',
            textLength: containerTextLength,
            buttonsCount: container.querySelectorAll('button, [role="button"]').length,
            imagesCount: container.querySelectorAll('img').length
          }
        });
      }
    });
    
    // Remove duplicates and add to allItems
    const uniquePotentialPosts = Array.from(
      new Map(potentialPosts.map(p => [p.element, p])).values()
    );
    
    // logger.log(`[Slop-Stop] Found ${uniquePotentialPosts.length} potential posts by aggressive fallback`);
    
    uniquePotentialPosts.forEach(({element}) => {
      if (!seen.has(element)) {
        seen.add(element);
        allItems.push(element);
      }
    });
    
    // logger.log(`[Slop-Stop] Total unique LinkedIn items found: ${allItems.length}`);
    
    // #region agent log
    const logDataReturn2 = {
      location: 'linkedin-adapter.ts:200',
      message: 'getCurrentItems returning (aggressive fallback)',
      data: {
        itemsCount: allItems.length,
        items: allItems.slice(0, 5).map(el => ({
          tagName: el.tagName,
          className: el.className?.substring(0, 50),
          id: el.id?.substring(0, 30),
          textLength: el.textContent?.length,
          buttonsCount: el.querySelectorAll('button, [role="button"]').length,
          imagesCount: el.querySelectorAll('img').length,
          childrenCount: el.children.length
        }))
      },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'run4',
      hypothesisId: 'D'
    };
    fetch('http://127.0.0.1:7243/ingest/b2719b1f-0fda-42ef-a1bf-85265994e0a0', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logDataReturn2)
    }).catch(() => {});
    // #endregion
    
    return allItems;
  }

  getItemId(element: HTMLElement): string | null {
    // Strategy 1: Try to find the unique post link/URL (like Twitter does)
    // LinkedIn posts have links like: https://www.linkedin.com/feed/update/urn:li:activity:XXXXXXX
    // or links with activity IDs in query params or path
    const postLinks = element.querySelectorAll<HTMLAnchorElement>('a[href*="/feed/update"], a[href*="activity"], a[href*="/posts/"]');
    for (const link of Array.from(postLinks)) {
      const href = link.href;
      // Try to extract activity ID from URL
      // Pattern 1: /feed/update/urn:li:activity:XXXXXXX
      let match = href.match(/\/feed\/update\/urn:li:activity:(\d+)/);
      if (match) {
        // #region agent log
        const logDataLink = {location:'linkedin-adapter.ts:517',message:'Found post ID from link URL',data:{activityId:match[1],href:href.substring(0,100),method:'feed/update/urn',timestamp:Date.now(),sessionId:'debug-session',runId:'run7',hypothesisId:'E'}};
        fetch('http://127.0.0.1:7243/ingest/b2719b1f-0fda-42ef-a1bf-85265994e0a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logDataLink)}).catch(()=>{});
        // #endregion
        return match[1];
      }
      // Pattern 2: /posts/XXXXXXX or activity=XXXXXXX in query params
      match = href.match(/\/posts\/([^/?]+)/) || href.match(/[?&]activity=([^&]+)/) || href.match(/activity[=:](\d+)/);
      if (match) {
        // #region agent log
        const logDataLink2 = {location:'linkedin-adapter.ts:525',message:'Found post ID from link URL (pattern 2)',data:{activityId:match[1],href:href.substring(0,100),method:'posts/activity',timestamp:Date.now(),sessionId:'debug-session',runId:'run7',hypothesisId:'E'}};
        fetch('http://127.0.0.1:7243/ingest/b2719b1f-0fda-42ef-a1bf-85265994e0a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logDataLink2)}).catch(()=>{});
        // #endregion
        return match[1];
      }
    }
    
    // Strategy 2: Try data-id first (LinkedIn uses this)
    let id = element.getAttribute('data-id');
    if (id?.startsWith('urn:li:activity:')) {
      const match = id.match(/urn:li:activity:(\d+)/);
      if (match) {
        // #region agent log
        const logDataAttr = {location:'linkedin-adapter.ts:533',message:'Found post ID from data-id attribute',data:{activityId:match[1],method:'data-id',timestamp:Date.now(),sessionId:'debug-session',runId:'run7',hypothesisId:'E'}};
        fetch('http://127.0.0.1:7243/ingest/b2719b1f-0fda-42ef-a1bf-85265994e0a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logDataAttr)}).catch(()=>{});
        // #endregion
        return match[1];
      }
      return id;
    }
    
    // Strategy 3: Try data-urn
    let urn = element.getAttribute('data-urn');
    
    // If not on the element itself, search in parent elements (up to 10 levels deep)
    if (!urn && !id) {
      let parent = element.parentElement;
      let depth = 0;
      while (parent && depth < 10) {
        // Also search for links in parent
        const parentLinks = parent.querySelectorAll<HTMLAnchorElement>('a[href*="/feed/update"], a[href*="activity"], a[href*="/posts/"]');
        for (const link of Array.from(parentLinks)) {
          const href = link.href;
          let match = href.match(/\/feed\/update\/urn:li:activity:(\d+)/) || href.match(/\/posts\/([^/?]+)/) || href.match(/[?&]activity=([^&]+)/) || href.match(/activity[=:](\d+)/);
          if (match) {
            // #region agent log
            const logDataParentLink = {location:'linkedin-adapter.ts:548',message:'Found post ID from parent link',data:{activityId:match[1],depth:depth,href:href.substring(0,100),timestamp:Date.now(),sessionId:'debug-session',runId:'run7',hypothesisId:'E'}};
            fetch('http://127.0.0.1:7243/ingest/b2719b1f-0fda-42ef-a1bf-85265994e0a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logDataParentLink)}).catch(()=>{});
            // #endregion
            return match[1];
          }
        }
        
        id = parent.getAttribute('data-id');
        if (id?.startsWith('urn:li:activity:')) {
          const match = id.match(/urn:li:activity:(\d+)/);
          if (match) return match[1];
          return id;
        }
        urn = parent.getAttribute('data-urn');
        if (urn?.startsWith('urn:li:activity:')) break;
        parent = parent.parentElement;
        depth++;
      }
    }
    
    
    if (urn?.startsWith('urn:li:activity:')) {
      const match = urn.match(/urn:li:activity:(\d+)/);
      if (match) {
        // #region agent log
        const logDataUrn = {location:'linkedin-adapter.ts:567',message:'Found post ID from data-urn attribute',data:{activityId:match[1],method:'data-urn',timestamp:Date.now(),sessionId:'debug-session',runId:'run7',hypothesisId:'E'}};
        fetch('http://127.0.0.1:7243/ingest/b2719b1f-0fda-42ef-a1bf-85265994e0a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logDataUrn)}).catch(()=>{});
        // #endregion
        return match[1];
      }
      return urn;
    }

    // Strategy 4: Try data-activity-id
    let activityId = element.getAttribute('data-activity-id');
    if (!activityId) {
      // Search in parent elements
      let parent = element.parentElement;
      let depth = 0;
      while (parent && depth < 10) {
        activityId = parent.getAttribute('data-activity-id');
        if (activityId) break;
        parent = parent.parentElement;
        depth++;
      }
    }
    
    if (activityId) {
      // #region agent log
      const logDataActivityId = {location:'linkedin-adapter.ts:586',message:'Found post ID from data-activity-id attribute',data:{activityId:activityId,method:'data-activity-id',timestamp:Date.now(),sessionId:'debug-session',runId:'run7',hypothesisId:'E'}};
      fetch('http://127.0.0.1:7243/ingest/b2719b1f-0fda-42ef-a1bf-85265994e0a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logDataActivityId)}).catch(()=>{});
      // #endregion
      return activityId;
    }

    // Last resort: generate ID from element position, content hash, and unique attributes
    // This allows us to work even if LinkedIn doesn't expose URNs
    // IMPORTANT: Don't use timestamp/random here - we need stable IDs for the same element
    // Use a stable hash based on content and position
    // #region agent log
    const logDataFallback = {location:'linkedin-adapter.ts:595',message:'Using fallback hash-based ID (no unique link found)',data:{elementTagName:element.tagName,hasLinks:postLinks.length>0,timestamp:Date.now(),sessionId:'debug-session',runId:'run7',hypothesisId:'E'}};
    fetch('http://127.0.0.1:7243/ingest/b2719b1f-0fda-42ef-a1bf-85265994e0a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logDataFallback)}).catch(()=>{});
    // #endregion
    
    const textContent = element.textContent?.substring(0, 300) || '';
    const position = Array.from(element.parentElement?.children || []).indexOf(element);
    
    // Include element's class names and any unique attributes for better uniqueness
    const className = element.className || '';
    const idAttr = element.id || '';
    
    // Try to find a more stable identifier - check for any data attributes
    const dataAttrs: string[] = [];
    Array.from(element.attributes).forEach(attr => {
      if (attr.name.startsWith('data-') && attr.value) {
        dataAttrs.push(`${attr.name}=${attr.value.substring(0, 50)}`);
      }
    });
    
    const uniqueString = `${textContent}-${className}-${idAttr}-${position}-${dataAttrs.join('-')}`;
    
    // Better hash function - stable across page loads
    let hash = 0;
    for (let i = 0; i < uniqueString.length; i++) {
      const char = uniqueString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    // Use a stable ID based on content hash and position (no timestamp/random)
    // This ensures the same post always gets the same ID
    return `linkedin-${position}-${Math.abs(hash)}`;
  }

  getUserIdentifier(element: HTMLElement): string | null {
    // Strategy 1: Look for profile links with /in/ pattern
    // LinkedIn uses links like linkedin.com/in/username-slug
    const profileLinks = element.querySelectorAll<HTMLAnchorElement>('a[href*="/in/"]');
    for (const link of Array.from(profileLinks)) {
      const href = link.href;
      // Match pattern: linkedin.com/in/username-slug
      const match = href.match(/linkedin\.com\/in\/([^\/\?]+)/);
      if (match && match[1]) {
        const profileSlug = match[1];
        // Skip common non-profile paths
        if (!['feed', 'jobs', 'messaging', 'notifications', 'learning', 'my-items'].includes(profileSlug.toLowerCase())) {
          return profileSlug;
        }
      }
    }

    // Strategy 2: Look for profile links in the post header/author section
    // LinkedIn posts usually have the author's profile link near the top
    const authorSection = element.querySelector('[data-testid="actor"], [class*="actor"], [class*="author"]');
    if (authorSection) {
      const authorLink = authorSection.querySelector<HTMLAnchorElement>('a[href*="/in/"]');
      if (authorLink) {
        const match = authorLink.href.match(/linkedin\.com\/in\/([^\/\?]+)/);
        if (match && match[1]) {
          return match[1];
        }
      }
    }

    // Strategy 3: Search parent elements for profile links (up to 5 levels)
    let parent = element.parentElement;
    let depth = 0;
    while (parent && depth < 5) {
      const parentLinks = parent.querySelectorAll<HTMLAnchorElement>('a[href*="/in/"]');
      for (const link of Array.from(parentLinks)) {
        const match = link.href.match(/linkedin\.com\/in\/([^\/\?]+)/);
        if (match && match[1]) {
          const profileSlug = match[1];
          if (!['feed', 'jobs', 'messaging', 'notifications', 'learning', 'my-items'].includes(profileSlug.toLowerCase())) {
            return profileSlug;
          }
        }
      }
      parent = parent.parentElement;
      depth++;
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
    
    // IMPORTANT: Ensure overlay stays within post container bounds
    // Set overflow: hidden on the container to prevent overlay from spilling out
    // Store original overflow value to potentially restore later
    const originalOverflow = computedStyle.overflow;
    if (originalOverflow !== 'hidden') {
      originalElement.style.overflow = 'hidden';
      // Store original overflow value as data attribute for potential restoration
      if (!originalElement.hasAttribute('data-slop-original-overflow')) {
        originalElement.setAttribute('data-slop-original-overflow', originalOverflow);
      }
    }
    
    // Store original height to ensure overlay covers it completely
    const originalHeight = originalElement.offsetHeight || originalElement.getBoundingClientRect().height;

    // Para LinkedIn no queremos mantener la altura original: debe colapsar.
    // Para otras plataformas mantenemos el comportamiento previo (min-height).
    if (this.getPlatformName() !== 'linkedin' && originalHeight > 0) {
      originalElement.style.minHeight = `${originalHeight}px`;
    } else {
      // En LinkedIn reducimos altura y eliminamos mínimos previos.
      originalElement.style.minHeight = '0px';
    }

    // LinkedIn-specific: al censurar, limitar altura máxima para ahorrar espacio.
    originalElement.style.maxHeight = '250px';
    
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
    
    // Also hide any images, videos, or other media directly in the element
    const images = originalElement.querySelectorAll('img, video, svg');
    images.forEach((media) => {
      (media as HTMLElement).style.visibility = 'hidden';
      (media as HTMLElement).style.pointerEvents = 'none';
    });
    
    // Disable pointer events on the container itself (but keep it visible for layout)
    originalElement.style.pointerEvents = 'none';
    
    // The Replacement: Create overlay as absolute child covering 100% of container
    // IMPORTANT: Use position: absolute (not fixed) so it stays within the post container
    const overlay = document.createElement('div');
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    if (originalHeight > 0) {
      // Mantener suficiente altura para que el overlay cubra el post,
      // pero respetando el límite de 250px del contenedor.
      const clampedHeight = Math.min(originalHeight, 250);
      overlay.style.minHeight = `${clampedHeight}px`;
      overlay.style.maxHeight = '250px';
    } else {
      overlay.style.maxHeight = '250px';
    }
    overlay.style.zIndex = '9999'; // High z-index but not too high to avoid overlapping navigation
    overlay.style.opacity = '1';
    overlay.style.visibility = 'visible';
    overlay.style.display = 'flex';
    overlay.style.pointerEvents = 'auto';
    overlay.style.overflow = 'hidden'; // Prevent content from spilling out
    overlay.setAttribute('data-slop-overlay', 'true');
    
    // #region agent log
    const logDataOverlay = {location:'linkedin-adapter.ts:650',message:'Creating overlay',data:{originalElementTag:originalElement.tagName,originalHeight:originalHeight,overlayPosition:'absolute',overlayZIndex:'9999',hasOverflowHidden:computedStyle.overflow==='hidden',timestamp:Date.now(),sessionId:'debug-session',runId:'run7',hypothesisId:'A'}};
    fetch('http://127.0.0.1:7243/ingest/b2719b1f-0fda-42ef-a1bf-85265994e0a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logDataOverlay)}).catch(()=>{});
    // #endregion
    
    // Insert overlay as a child of the original element
    originalElement.appendChild(overlay);
    
    return overlay;
  }
}
