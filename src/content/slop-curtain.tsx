export interface SlopCurtainOptions {
  reportCount: number;
  onShow: () => void;
  onReport: () => void;
}

export const createSlopCurtain = (options: SlopCurtainOptions): HTMLElement => {
  const curtain = document.createElement('div');
  curtain.className = 'slop-curtain';
  curtain.setAttribute('data-slop-curtain', 'true');

  // Main content container (centered)
  const contentContainer = document.createElement('div');
  contentContainer.className = 'slop-curtain-content';

  const headline = document.createElement('h2');
  headline.className = 'slop-curtain-headline';
  headline.textContent = 'Slop content flagged by the community';

  const subtext = document.createElement('p');
  subtext.className = 'slop-curtain-subtext';
  subtext.textContent = 'Flagged as low-quality slop by Human Resistance curators.';

  // Counter badge
  const counterBadge = document.createElement('div');
  counterBadge.className = 'slop-curtain-counter';
  counterBadge.textContent = `${options.reportCount} Community Report${options.reportCount !== 1 ? 's' : ''}`;

  contentContainer.appendChild(headline);
  contentContainer.appendChild(subtext);
  contentContainer.appendChild(counterBadge);

  // Show button (positioned in bottom-right corner)
  const showButton = document.createElement('button');
  showButton.className = 'slop-curtain-show-button';
  showButton.textContent = 'Show';
  showButton.setAttribute('aria-label', 'Show slop content');
  showButton.setAttribute('tabindex', '0');
  showButton.style.pointerEvents = 'auto';
  showButton.style.zIndex = '10001';
  
  const handleShow = () => {
    // Add smooth fade-out transition
    curtain.style.transition = 'opacity 0.3s ease-out';
    curtain.style.opacity = '0';
    
    // Call onShow after transition completes
    setTimeout(() => {
      options.onShow();
    }, 300);
  };
  
  showButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    handleShow();
  });
  showButton.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      handleShow();
    }
  });

  curtain.appendChild(contentContainer);
  curtain.appendChild(showButton);

  return curtain;
};

export const updateSlopCurtainCounter = (curtain: HTMLElement, reportCount: number): void => {
  // Counter removed - no longer needed
};
