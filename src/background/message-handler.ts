import { getSupabaseClient } from './supabase-client.js';
import { getReporterHash } from './reporter-hash.js';
import {
  Message,
  MessageType,
  ReportSlopPayload,
  ReportWebsitePayload,
  GetSlopStatusPayload,
  SlopStatusResponse,
  Settings,
  Platform,
  SubmitFeedbackPayload,
} from '../shared/types.js';
import { DEFAULT_REPORT_LIMIT_THRESHOLD, STORAGE_KEYS } from '../shared/constants.js';

export const handleMessage = async (
  message: Message,
  sendResponse: (response?: unknown) => void
): Promise<boolean> => {
  try {
    switch (message.type) {
      case MessageType.REPORT_SLOP: {
        try {
          const payload = message.payload as ReportSlopPayload;
          console.log('[Slop-Stop] REPORT_SLOP: received', { itemId: payload.itemId, platform: payload.platform });
          const reporterHash = await getReporterHash();
          console.log('[Slop-Stop] REPORT_SLOP: got reporter hash', { reporterHash: reporterHash.substring(0, 8) + '...' });
          let supabase;
          try {
            supabase = await getSupabaseClient();
            console.log('[Slop-Stop] REPORT_SLOP: got supabase client');
          } catch (error) {
            // Supabase not configured - return success but with 0 report count
            console.warn('[Slop-Stop] REPORT_SLOP: Supabase not configured', error);
            sendResponse({ success: true, reportCount: 0 });
            return true;
          }

          console.log('[Slop-Stop] REPORT_SLOP: calling RPC', { itemId: payload.itemId, platform: payload.platform });
          let rpcResult;
          try {
            rpcResult = await supabase.rpc('report_slop', {
              p_item_id: payload.itemId,
              p_platform: payload.platform,
              p_reporter_hash: reporterHash,
            });
          } catch (fetchError) {
            // Network errors or Supabase not configured - return success but with 0 report count
            const errorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
            console.error('[Slop-Stop] REPORT_SLOP: RPC call failed', { errorMsg, itemId: payload.itemId });
            rpcResult = { data: 0, error: { message: 'Network error', details: errorMsg } };
          }
          const { data, error } = rpcResult;

          if (error) {
            const errorMessage = error.message || 'Unknown error';
            const errorDetails = error.details ? ` Details: ${error.details}` : '';
            const errorHint = error.hint ? ` Hint: ${error.hint}` : '';
            console.error('[Slop-Stop] REPORT_SLOP: RPC returned error', { 
              errorMessage, 
              errorDetails, 
              errorHint, 
              itemId: payload.itemId,
              platform: payload.platform 
            });
            sendResponse({ success: false, error: errorMessage });
            return true;
          }

          console.log('[Slop-Stop] REPORT_SLOP: success', { itemId: payload.itemId, reportCount: data || 0 });
          sendResponse({ success: true, reportCount: data || 0 });
          return true;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error('[Slop-Stop] REPORT_SLOP: exception', { errorMessage, stack: error instanceof Error ? error.stack : undefined });
          sendResponse({ success: false, error: errorMessage });
          return true;
        }
      }

      case MessageType.REPORT_WEBSITE: {
        try {
          const payload = message.payload as ReportWebsitePayload;
          const reporterHash = await getReporterHash();
          let supabase;
          try {
            supabase = await getSupabaseClient();
          } catch (error) {
            // Supabase not configured - return success but with 0 report count
            sendResponse({ success: true, reportCount: 0, shouldBlock: false });
            return true;
          }

          let rpcResult;
          try {
            rpcResult = await supabase.rpc('report_slop', {
              p_item_id: payload.url,
              p_platform: 'website' as Platform,
              p_reporter_hash: reporterHash,
            });
          } catch (fetchError) {
            // Network errors or Supabase not configured - return success but with 0 report count
            const errorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
            if (!errorMsg.includes('Failed to fetch') && !errorMsg.includes('NetworkError')) {
              console.error('Error calling report_slop RPC for website:', errorMsg);
            }
            rpcResult = { data: 0, error: { message: 'Network error', details: errorMsg } };
          }
          const { data, error } = rpcResult;

          if (error) {
            const errorMessage = error.message || 'Unknown error';
            const errorDetails = error.details ? ` Details: ${error.details}` : '';
            const errorHint = error.hint ? ` Hint: ${error.hint}` : '';
            // Only log non-network errors
            if (!errorMessage.includes('Failed to fetch') && !errorMessage.includes('NetworkError')) {
              console.error('Error reporting website:', errorMessage + errorDetails + errorHint);
            }
            sendResponse({ success: false, error: errorMessage, shouldBlock: false });
            return true;
          }

          const settings = await getSettings();
          const threshold = settings.reportLimitThreshold || DEFAULT_REPORT_LIMIT_THRESHOLD;
          const shouldBlock = (data || 0) >= threshold;

          sendResponse({
            success: true,
            reportCount: data || 0,
            shouldBlock,
          });
          return true;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          // Only log non-network errors
          if (!errorMessage.includes('Failed to fetch') && !errorMessage.includes('NetworkError')) {
            console.error('Error in REPORT_WEBSITE handler:', errorMessage);
          }
          sendResponse({ success: false, error: errorMessage, shouldBlock: false });
          return true;
        }
      }

      case MessageType.GET_SLOP_STATUS: {
        try {
          const payload = message.payload as GetSlopStatusPayload;
          let supabase;
          try {
            supabase = await getSupabaseClient();
          } catch (error) {
            // Supabase not configured - return safe default
            sendResponse({ isSlop: false, reportCount: 0 });
            return true;
          }

          let rpcResult;
          try {
            rpcResult = await supabase.rpc('get_slop_status', {
              p_item_id: payload.itemId,
              p_platform: payload.platform,
            });
          } catch (fetchError) {
            // Network errors or Supabase not configured - return safe default
            const errorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
            if (!errorMsg.includes('Failed to fetch') && !errorMsg.includes('NetworkError')) {
              console.error('Error calling get_slop_status RPC:', errorMsg);
            }
            rpcResult = { data: null, error: { message: 'Network error', details: errorMsg } };
          }
          const { data, error } = rpcResult;

          if (error) {
            const errorMessage = error.message || 'Unknown error';
            const errorDetails = error.details ? ` Details: ${error.details}` : '';
            const errorHint = error.hint ? ` Hint: ${error.hint}` : '';
            // Only log non-network errors (network errors are expected if Supabase is not configured)
            if (!errorMessage.includes('Failed to fetch') && !errorMessage.includes('NetworkError')) {
              console.error('Error getting slop status:', errorMessage + errorDetails + errorHint);
            }
            // Return safe default instead of throwing
            sendResponse({ isSlop: false, reportCount: 0 });
            return true;
          }

          const response: SlopStatusResponse = {
            isSlop: data?.report_count > 0 || false,
            reportCount: data?.report_count || 0,
          };

          sendResponse(response);
          return true;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          // Only log non-network errors (network errors are expected if Supabase is not configured)
          if (!errorMessage.includes('Failed to fetch') && !errorMessage.includes('NetworkError')) {
            console.error('Error in GET_SLOP_STATUS handler:', errorMessage);
          }
          // Return safe default
          sendResponse({ isSlop: false, reportCount: 0 });
          return true;
        }
      }

      case MessageType.GET_SETTINGS: {
        const settings = await getSettings();
        sendResponse(settings);
        return true;
      }

      case MessageType.SET_SETTINGS: {
        const newSettings = message.payload as Partial<Settings>;
        await setSettings(newSettings);
        sendResponse({ success: true });
        return true;
      }

      case MessageType.SUBMIT_FEEDBACK: {
        try {
          const payload = message.payload as SubmitFeedbackPayload;
          const trimmedFeedback = (payload.feedback || '').trim();

          if (!trimmedFeedback) {
            sendResponse({ success: false, error: 'Feedback cannot be empty' });
            return true;
          }

          let supabase;
          try {
            supabase = await getSupabaseClient();
          } catch (error) {
            sendResponse({ success: false, error: 'Supabase is not configured' });
            return true;
          }

          const reporterHash = await getReporterHash();
          const { error } = await supabase.from('slop_feedback').insert({
            feedback: trimmedFeedback,
            reporter_hash: reporterHash,
          });

          if (error) {
            const errorMessage = error.message || 'Unknown error';
            const errorDetails = error.details ? ` Details: ${error.details}` : '';
            sendResponse({ success: false, error: errorMessage + errorDetails });
            return true;
          }

          sendResponse({ success: true });
          return true;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          sendResponse({ success: false, error: errorMessage });
          return true;
        }
      }

      default:
        sendResponse({ error: 'Unknown message type' });
        return true;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('Error handling message:', errorMessage, errorStack || '', error);
    sendResponse({ error: errorMessage });
    return true;
  }
};

const getSettings = async (): Promise<Settings> => {
  const stored = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
  const settings = stored[STORAGE_KEYS.SETTINGS] || {};
  
  return {
    reportLimitThreshold: settings.reportLimitThreshold || DEFAULT_REPORT_LIMIT_THRESHOLD,
    supabaseUrl: settings.supabaseUrl,
    supabaseAnonKey: settings.supabaseAnonKey,
  };
};

const setSettings = async (newSettings: Partial<Settings>): Promise<void> => {
  const current = await getSettings();
  const updated = { ...current, ...newSettings };
  await chrome.storage.sync.set({ [STORAGE_KEYS.SETTINGS]: updated });
};
