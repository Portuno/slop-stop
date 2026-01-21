export type Platform = 'twitter' | 'youtube' | 'linkedin' | 'website';

export interface SlopReport {
  id: string;
  item_id: string;
  platform: Platform;
  reporter_hash: string;
  created_at: string;
}

export interface Settings {
  reportLimitThreshold: number;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

export interface Message {
  type: MessageType;
  payload?: unknown;
}

export enum MessageType {
  REPORT_SLOP = 'REPORT_SLOP',
  REPORT_WEBSITE = 'REPORT_WEBSITE',
  GET_SLOP_STATUS = 'GET_SLOP_STATUS',
  GET_SETTINGS = 'GET_SETTINGS',
  SET_SETTINGS = 'SET_SETTINGS',
  CONTEXT_MENU_REPORT_SLOP = 'CONTEXT_MENU_REPORT_SLOP',
  SUBMIT_FEEDBACK = 'SUBMIT_FEEDBACK',
}

export interface ReportSlopPayload {
  itemId: string;
  platform: Platform;
}

export interface ReportWebsitePayload {
  url: string;
}

export interface SubmitFeedbackPayload {
  feedback: string;
}

export interface GetSlopStatusPayload {
  itemId: string;
  platform: Platform;
}

export interface SlopStatusResponse {
  isSlop: boolean;
  reportCount: number;
}

export interface PlatformAdapter {
  getItemId(element: HTMLElement): string | null;
  getItemSelector(): string;
  observeItems(callback: (items: HTMLElement[]) => void): () => void;
  createGhostContainer(originalElement: HTMLElement): HTMLElement;
  getPlatformName(): Platform;
  canHandleUrl(url: string): boolean;
}
