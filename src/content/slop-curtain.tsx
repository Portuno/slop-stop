export interface SlopCurtainOptions {
  reportCount: number;
  platform?: 'youtube' | 'twitter' | 'linkedin' | 'website';
  onShow: () => void;
  onReport: () => void;
}

export const createSlopCurtain = (options: SlopCurtainOptions): HTMLElement => {
  const curtain = document.createElement('div');
  curtain.className = `slop-curtain${options.platform ? ` slop-curtain--${options.platform}` : ''}`;
  curtain.setAttribute('data-slop-curtain', 'true');

  if (options.platform === 'website') {
    document.body.dataset.slopCurtainScrollLocked = 'true';
    document.body.style.overflow = 'hidden';
  }

  const handleShow = () => {
    // Add smooth fade-out transition
    curtain.style.transition = 'opacity 0.3s ease-out';
    curtain.style.opacity = '0';
    
    // Call onShow after transition completes
    setTimeout(() => {
      options.onShow();
      if (document.body.dataset.slopCurtainScrollLocked) {
        document.body.style.overflow = '';
        delete document.body.dataset.slopCurtainScrollLocked;
      }
    }, 300);
  };

  // Main content container (centered)
  const contentContainer = document.createElement('div');
  contentContainer.className = 'slop-curtain-content';

  if (options.platform === 'website') {
    // Immersive security screen for websites
    const gradientOverlay = document.createElement('div');
    gradientOverlay.className = 'slop-curtain-gradient';
    curtain.appendChild(gradientOverlay);

    contentContainer.classList.add('slop-curtain-content--website');

    const icon = document.createElement('div');
    icon.className = 'slop-curtain-icon';
    icon.innerHTML = '⚠️';
    icon.setAttribute('aria-hidden', 'true');

    const headline = document.createElement('h2');
    headline.className = 'slop-curtain-headline';
    headline.textContent = 'Access Restricted: Community-Flagged Slop';

    const subtext = document.createElement('p');
    subtext.className = 'slop-curtain-subtext';
    subtext.textContent =
      'Human curators have identified this entire website as a primary source of AI-generated filler or low-quality content.';

    const counterBadge = document.createElement('div');
    counterBadge.className = 'slop-curtain-counter';
    counterBadge.textContent = `[${options.reportCount}] Humans have flagged this domain as Slop`;

    const buttons = document.createElement('div');
    buttons.className = 'slop-curtain-buttons';

    const returnButton = document.createElement('button');
    returnButton.className = 'slop-curtain-button slop-curtain-button--primary';
    returnButton.textContent = 'Take me back to safety';
    returnButton.setAttribute('aria-label', 'Return to previous page');
    returnButton.setAttribute('tabindex', '0');

    const handleReturn = () => {
      window.history.back();
      if (document.body.dataset.slopCurtainScrollLocked) {
        document.body.style.overflow = '';
        delete document.body.dataset.slopCurtainScrollLocked;
      }
      curtain.remove();
    };

    returnButton.addEventListener('click', handleReturn);
    returnButton.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleReturn();
      }
    });

    const continueButton = document.createElement('button');
    continueButton.className = 'slop-curtain-button slop-curtain-button--secondary';
    continueButton.textContent = 'Continue anyway';
    continueButton.setAttribute('aria-label', 'Continue to website anyway');
    continueButton.setAttribute('tabindex', '0');

    const handleContinue = () => {
      handleShow();
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

    contentContainer.appendChild(icon);
    contentContainer.appendChild(headline);
    contentContainer.appendChild(subtext);
    contentContainer.appendChild(counterBadge);
    contentContainer.appendChild(buttons);
  } else {
    const headline = document.createElement('h2');
    headline.className = 'slop-curtain-headline';
    headline.textContent = 'Slop content flagged by the community';

    const subtext = document.createElement('p');
    subtext.className = 'slop-curtain-subtext';
    subtext.textContent =
      'This content was identified as AI-generated filler or low-quality slop by Human Resistance curators.';

    const counterBadge = document.createElement('div');
    counterBadge.className = 'slop-curtain-counter';
    counterBadge.textContent = `[${options.reportCount}] Community Reports`;

    contentContainer.appendChild(headline);
    contentContainer.appendChild(subtext);
    contentContainer.appendChild(counterBadge);
  }

  // Show button (only for non-website content overlays)
  if (options.platform !== 'website') {
    const showButton = document.createElement('button');
    showButton.className = 'slop-curtain-show-button';
    showButton.textContent = 'Show';
    showButton.setAttribute('aria-label', 'Show slop content');
    showButton.setAttribute('tabindex', '0');
    showButton.style.pointerEvents = 'auto';
    showButton.style.zIndex = '10001';
  
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
    curtain.appendChild(showButton);
  }

  curtain.appendChild(contentContainer);

  return curtain;
};

export const updateSlopCurtainCounter = (curtain: HTMLElement, reportCount: number): void => {
  // Counter removed - no longer needed
};
