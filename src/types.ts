export interface SavedAccount {
  msisdn: string;
  maskedMsisdn: string;
  operator: string;
  created_at: number;
  linked_at?: number;
  hasToken: boolean;
}

export interface ActivationItem {
  id: string;
  msisdn: string;
  maskedMsisdn?: string;
  timestamp: number;
  success: boolean;
  message: string;
  details?: {
    reward?: string;
    validity?: string;
    bundleCode?: string;
  };
}

export interface ServerStatus {
  name: string;
  appVersion: string;
  ooredooVersion: string;
  totalSavedAccounts: number;
  totalActivations: number;
  telegramConfig: {
    botToken: string;
    channel: string;
    adminId: number;
  };
  proxiesConfigured: number;
}

export interface TelegramLogEntry {
  id: string;
  timestamp: number;
  type: 'in_msg' | 'out_msg' | 'callback' | 'system' | 'error';
  from: string;
  chatId: string | number;
  text: string;
  details?: string;
}

export interface TelegramBotStatus {
  isPolling: boolean;
  botToken: string;
  botInfo: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username?: string;
  } | null;
  channel: string;
  adminId: number;
  totalMessagesReceived: number;
  totalActivationsViaTelegram: number;
  lastActiveTime: number | null;
  logs: TelegramLogEntry[];
}
