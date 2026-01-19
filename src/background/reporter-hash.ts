import { STORAGE_KEYS } from '../shared/constants.js';
import { generateUUID } from '../shared/utils.js';

export const getReporterHash = async (): Promise<string> => {
  const stored = await chrome.storage.sync.get(STORAGE_KEYS.REPORTER_HASH);
  const hash = stored[STORAGE_KEYS.REPORTER_HASH];

  if (hash) {
    return hash;
  }

  const newHash = generateUUID();
  await chrome.storage.sync.set({ [STORAGE_KEYS.REPORTER_HASH]: newHash });
  return newHash;
};
