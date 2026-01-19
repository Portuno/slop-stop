export interface ConfirmationModalOptions {
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const createConfirmationModal = (options: ConfirmationModalOptions): HTMLElement => {
  const overlay = document.createElement('div');
  overlay.className = 'slop-confirmation-overlay';
  overlay.setAttribute('data-slop-modal', 'true');

  const modal = document.createElement('div');
  modal.className = 'slop-confirmation-modal';

  const message = document.createElement('p');
  message.className = 'slop-confirmation-message';
  message.textContent = options.message;

  const buttons = document.createElement('div');
  buttons.className = 'slop-confirmation-buttons';

  const cancelButton = document.createElement('button');
  cancelButton.className = 'slop-confirmation-cancel';
  cancelButton.textContent = options.cancelText || 'Cancel';
  cancelButton.setAttribute('aria-label', 'Cancel');
  cancelButton.setAttribute('tabindex', '0');
  cancelButton.addEventListener('click', options.onCancel);
  cancelButton.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      options.onCancel();
    }
  });

  const confirmButton = document.createElement('button');
  confirmButton.className = 'slop-confirmation-confirm';
  confirmButton.textContent = options.confirmText || 'Confirm';
  confirmButton.setAttribute('aria-label', 'Confirm');
  confirmButton.setAttribute('tabindex', '0');
  confirmButton.addEventListener('click', options.onConfirm);
  confirmButton.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      options.onConfirm();
    }
  });

  buttons.appendChild(cancelButton);
  buttons.appendChild(confirmButton);

  modal.appendChild(message);
  modal.appendChild(buttons);
  overlay.appendChild(modal);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      options.onCancel();
    } else if (e.key === 'Enter' && e.target === overlay) {
      options.onConfirm();
    }
  };

  overlay.addEventListener('keydown', handleKeyDown);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      options.onCancel();
    }
  });

  setTimeout(() => {
    confirmButton.focus();
  }, 0);

  return overlay;
};

export const removeConfirmationModal = (modal: HTMLElement): void => {
  modal.remove();
};
