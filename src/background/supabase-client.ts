import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../shared/config.js';

let supabaseClient: SupabaseClient | null = null;

const createChromeStorageAdapter = () => {
  return {
    getItem: async (key: string): Promise<string | null> => {
      const result = await chrome.storage.sync.get(key);
      return result[key] ?? null;
    },
    setItem: async (key: string, value: string): Promise<void> => {
      await chrome.storage.sync.set({ [key]: value });
    },
    removeItem: async (key: string): Promise<void> => {
      await chrome.storage.sync.remove(key);
    },
  };
};

const isValidSupabaseUrl = (url: string): boolean => {
  if (!url || typeof url !== 'string') {
    return false;
  }
  const trimmed = url.trim();
  if (trimmed === '') {
    return false;
  }
  // Supabase URLs must be absolute HTTPS URLs
  try {
    const urlObj = new URL(trimmed);
    return urlObj.protocol === 'https:' && urlObj.hostname.length > 0;
  } catch {
    return false;
  }
};

export const getSupabaseClient = async (): Promise<SupabaseClient> => {
  if (supabaseClient) {
    return supabaseClient;
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !isValidSupabaseUrl(SUPABASE_URL)) {
    // Supabase not configured - this is OK, the extension will work in offline mode
    // Create a dummy client that will fail gracefully
    const errorMsg = 'Supabase configuration not found or invalid. Extension will work in offline mode.';
    // logger.warn('[Slop-Stop]', errorMsg);
    // Return a client that will fail gracefully on requests
    supabaseClient = createClient('https://placeholder.supabase.co', 'placeholder-key', {
      auth: {
        storage: createChromeStorageAdapter(),
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }) as SupabaseClient;
    return supabaseClient;
  }

  try {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: createChromeStorageAdapter(),
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
        flowType: 'pkce',
        // Provide a valid redirect URL to prevent jSecure errors
        // Using the Supabase project URL as redirect since we don't need actual auth
        redirectTo: SUPABASE_URL,
      },
      global: {
        // Disable automatic token refresh and session management
        headers: {},
      },
    });

    return supabaseClient;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // logger.error('[Slop-Stop] Error creating Supabase client:', errorMessage);
    throw error;
  }
};
