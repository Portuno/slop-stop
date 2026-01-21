import type { PlatformAdapter } from '../shared/types';

type LinkedInCandidate = {
  element: HTMLElement;
  height: number;
  textLength: number;
};

const hasLinkedInSignals = (element: HTMLElement): boolean => {
  const buttons = element.querySelectorAll('button, [role="button"]');
  const images = element.querySelectorAll('img');

  const hasEngagementButtons = Array.from(buttons).some((btn) => {
    const btnText = (btn.textContent || '').toLowerCase();
    return (
      btnText.includes('like') ||
      btnText.includes('recomendar') ||
      btnText.includes('comment') ||
      btnText.includes('comentar') ||
      btnText.includes('share') ||
      btnText.includes('compartir')
    );
  });

  const hasProfileImage = Array.from(images).some((img) => {
    const alt = (img.getAttribute('alt') || '').toLowerCase();
    return alt.includes('profile') || alt.includes('avatar') || alt.includes('member');
  });

  return hasEngagementButtons || hasProfileImage;
};

const isDefinitelyNotAPostContainer = (element: HTMLElement): boolean => {
  if (element.tagName === 'MAIN') return true;
  if (element.id === 'workspace') return true;

  // Avoid selecting huge containers (feed/root wrappers) that would block everything.
  const textLength = element.textContent?.length || 0;
  if (textLength > 9000) return true;

  const rect = element.getBoundingClientRect();
  if (rect.height > 2600) return true;

  return false;
};

const isLikelyLinkedInPostContainer = (element: HTMLElement): boolean => {
  if (isDefinitelyNotAPostContainer(element)) return false;

  const textLength = element.textContent?.length || 0;
  if (textLength < 50) return false;

  // LinkedIn posts are usually not massive walls of text inside a single container.
  if (textLength > 8000) return false;

  const rect = element.getBoundingClientRect();
  if (rect.height < 120) return false;

  // Require at least some LinkedIn-ish signals to avoid generic wrappers.
  if (!hasLinkedInSignals(element)) return false;

  return true;
};

const scoreCandidates = (candidates: HTMLElement[]): LinkedInCandidate[] => {
  return candidates
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        element,
        height: rect.height || element.offsetHeight || 0,
        textLength: element.textContent?.length || 0,
      };
    })
    .filter((c) => c.height > 0);
};

export const findLinkedInPostContainer = (
  target: HTMLElement,
  adapter: PlatformAdapter
): HTMLElement | null => {
  if (adapter.getPlatformName() !== 'linkedin') {
    return null;
  }

  // Strategy 1: Use adapter's post detection, but pick the smallest valid container
  // that contains the click target (prevents selecting a feed wrapper).
  const allItems = adapter.getCurrentItems();
  const containingCandidates = allItems.filter(
    (el) => el.contains(target) && isLikelyLinkedInPostContainer(el)
  );

  const scored = scoreCandidates(containingCandidates).sort((a, b) => {
    // Prefer the most specific (smallest height) container.
    if (a.height !== b.height) return a.height - b.height;
    // Tie-breaker: less text usually means less wrapper-y.
    return a.textLength - b.textLength;
  });

  if (scored.length > 0) {
    return scored[0]!.element;
  }

  // Strategy 2: Fallback DOM walk (upwards), first element that passes heuristics
  let current: HTMLElement | null = target;
  let depth = 0;
  while (current && depth < 25) {
    if (isLikelyLinkedInPostContainer(current)) {
      return current;
    }
    current = current.parentElement;
    depth++;
  }

  return null;
};
