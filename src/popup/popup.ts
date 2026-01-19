import { STORAGE_KEYS, DEFAULT_REPORT_LIMIT_THRESHOLD } from '../shared/constants.js';

const form = document.getElementById('settingsForm') as HTMLFormElement;
const reportLimitInput = document.getElementById('reportLimit') as HTMLInputElement;
const saveButton = document.getElementById('saveButton') as HTMLButtonElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;

const showStatus = (message: string, isError = false) => {
  statusDiv.textContent = message;
  statusDiv.className = `status ${isError ? 'error' : 'success'}`;
  statusDiv.style.display = 'block';
  
  setTimeout(() => {
    statusDiv.style.display = 'none';
  }, 3000);
};

const loadSettings = async () => {
  try {
    const settings = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
    const storedSettings = settings[STORAGE_KEYS.SETTINGS] || {};
    
    if (storedSettings.reportLimitThreshold) {
      reportLimitInput.value = storedSettings.reportLimitThreshold.toString();
    } else {
      reportLimitInput.value = DEFAULT_REPORT_LIMIT_THRESHOLD.toString();
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
};

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
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
    saveButton.disabled = false;
    saveButton.textContent = 'Save Settings';
  } catch (error) {
    console.error('Error saving settings:', error);
    showStatus('Error saving settings', true);
    saveButton.disabled = false;
    saveButton.textContent = 'Save Settings';
  }
});

loadSettings();
