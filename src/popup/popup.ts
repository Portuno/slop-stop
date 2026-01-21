import { STORAGE_KEYS, DEFAULT_REPORT_LIMIT_THRESHOLD } from '../shared/constants.js';
import { MessageType } from '../shared/types.js';

const form = document.getElementById('settingsForm') as HTMLFormElement | null;
const reportLimitInput = document.getElementById('reportLimit') as HTMLInputElement | null;
const saveButton = document.getElementById('saveButton') as HTMLButtonElement | null;
const statusDiv = document.getElementById('status') as HTMLDivElement | null;

const feedbackForm = document.getElementById('feedbackForm') as HTMLFormElement | null;
const feedbackInput = document.getElementById('feedbackText') as HTMLTextAreaElement | null;
const feedbackButton = document.getElementById('feedbackButton') as HTMLButtonElement | null;
const feedbackStatus = document.getElementById('feedbackStatus') as HTMLDivElement | null;

const showStatus = (message: string, isError = false, target?: HTMLDivElement | null) => {
  const destination = target ?? statusDiv;
  if (!destination) return;

  destination.textContent = message;
  destination.className = `status ${isError ? 'error' : 'success'}`;
  destination.style.display = 'block';
  
  setTimeout(() => {
    destination.style.display = 'none';
  }, 3000);
};

const loadSettings = async () => {
  try {
    const settings = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
    const storedSettings = settings[STORAGE_KEYS.SETTINGS] || {};
    
    if (reportLimitInput) {
      if (storedSettings.reportLimitThreshold) {
        reportLimitInput.value = storedSettings.reportLimitThreshold.toString();
      } else {
        reportLimitInput.value = DEFAULT_REPORT_LIMIT_THRESHOLD.toString();
      }
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
};

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (!reportLimitInput || !saveButton) {
    return;
  }

  saveButton.disabled = true;
  saveButton.textContent = 'Saving...';
  
  try {
    const reportLimit = parseInt(reportLimitInput.value, 10);
    
    if (isNaN(reportLimit) || reportLimit < 1) {
      showStatus('Please enter a valid number (minimum 1)', true);
      saveButton.disabled = false;
      saveButton.textContent = 'Save Settings';
      return;
    }
    
    await chrome.storage.sync.set({
      [STORAGE_KEYS.SETTINGS]: {
        reportLimitThreshold: reportLimit,
      },
    });
    
    showStatus('Settings saved successfully!');
  } catch (error) {
    console.error('Error saving settings:', error);
    showStatus('Error saving settings', true);
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = 'Save Settings';
  }
});

feedbackForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!feedbackInput || !feedbackButton || !feedbackStatus) {
    return;
  }

  const feedback = feedbackInput.value.trim();

  if (!feedback) {
    showStatus('Comparte feedback antes de enviarlo.', true, feedbackStatus);
    return;
  }

  feedbackButton.disabled = true;
  feedbackButton.textContent = 'Enviando...';

  try {
    const response = await chrome.runtime.sendMessage({
      type: MessageType.SUBMIT_FEEDBACK,
      payload: { feedback },
    });

    if (response?.success) {
      showStatus('Feedback enviado. ¡Gracias!', false, feedbackStatus);
      feedbackInput.value = '';
    } else {
      const errorMessage = response?.error || 'No se pudo enviar el feedback.';
      showStatus(errorMessage, true, feedbackStatus);
    }
  } catch (error) {
    console.error('Error sending feedback:', error);
    showStatus('No se pudo enviar el feedback.', true, feedbackStatus);
  } finally {
    feedbackButton.disabled = false;
    feedbackButton.textContent = 'Enviar feedback';
  }
});

loadSettings();
