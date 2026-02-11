import type { ProviderId } from './types';

export const ERROR_MESSAGES = {
  API: {
    REQUEST_FAILED: (status: number | string, statusText: string) => `API Error: ${status} ${statusText}`,
    UNKNOWN: (message: string) => `Error: ${message}`,
    NETWORK_ERROR: (message: string) => `Error: ${message}`,
    NO_DATA: (context?: string) => `No usage data${context ? `. Context: ${context}` : ''}`,
  },
  AUTH: {
    FAILED: 'Authentication failed',
    TOKEN_EXCHANGE_FAILED: (reason: string) => `Token exchange failed: ${reason}`,
    NO_REFRESH_TOKEN: 'No refresh token returned',
    REFRESH_FAILED: 'Token refresh failed',
    INVALID_FORMAT: 'Invalid credential format',
    NO_ACCESS_TOKEN: 'No valid access token',
    CANCELED: 'Canceled',
    API_KEY_EMPTY: 'API Key cannot be empty',
    API_KEY_INVALID: (prefix: string) => `Invalid API Key format, should start with ${prefix}`,
    NO_GITHUB_TOKEN: 'No GitHub token. Please re-login.',
  },
  GEMINI: {
    PROJECT_LOAD_FAILED: 'Failed to load project',
    QUOTA_FETCH_FAILED: 'Failed to fetch quota',
  },
} as const;

/* eslint-disable @typescript-eslint/naming-convention */
export const PROVIDERS = {
  ZHIPU: { ID: 'zhipu', NAME: 'Zhipu AI' },
  ZAI: { ID: 'zai', NAME: 'Z.ai' },
  ANTIGRAVITY: { ID: 'google-antigravity', NAME: 'Google Antigravity' },
  GITHUB: { ID: 'github-copilot', NAME: 'GitHub Copilot' },
  GEMINI: { ID: 'gemini-cli', NAME: 'Gemini CLI' },
  KIMI: { ID: 'kimi-code', NAME: 'Kimi Code' },
} as const satisfies Record<string, { ID: ProviderId; NAME: string }>;

export const UI_TEXT = {
  PLACEHOLDERS: {
    ENTER_KEY: (name: string) => `Enter ${name} Key`,
    LOGIN_OAUTH: (name: string) => `Login with ${name} OAuth`,
    LOCAL_LOGS: 'Read from local logs',
    MANAGE_ACCOUNTS: 'Manage accounts or add new provider',
    SELECT_PROVIDER: 'Select provider to add',
    SELECT_ACTION: 'Select action',
    ALIAS_EXAMPLE: 'e.g. Work, Personal, Team, etc.',
    CURRENT_NAME: (name: string) => `Current name: ${name}`,
  },
  TITLES: {
    SETTINGS: 'Settings',
    SELECT_PROVIDER: 'Select Provider',
    ACCOUNT_ALIAS: 'Account Alias (Optional)',
    ACCOUNT_NAME: 'Account Name',
    ENTER_KEY: (name: string) => `Enter ${name} API Key`,
    API_KEY_INFO: (name: string) => `${name} API Key`,
  },
  PROMPTS: {
    SET_ALIAS: 'Set an alias for this account to distinguish multiple accounts',
    SET_NAME: 'Set a name for this account',
    KEY_FORMAT: (prefix: string) => `Format: ${prefix}xxxxxxxxx (starts with ${prefix})`,
  },
  ACTIONS: {
    ADD_PROVIDER: '$(plus) Add provider',
    ADD_PROVIDER_DESC: 'Login to new provider',
    BACK: '$(arrow-left) Back',
    NAME: '$(pencil) Name',
    NAME_DESC: 'Modify account name',
    RELOGIN: '$(sign-in) Relogin',
    RELOGIN_DESC: "Update this account's credentials",
    LOGOUT: '$(sign-out) Logout',
    LOGOUT_DESC: 'Delete this account',
    OPEN_DOCS: 'Open docs to get Key',
    OPEN_WEBSITE: 'Open website to get Key',
  },
  AUTH_TYPE: {
    OAUTH: 'OAuth Login',
    API_KEY: 'API Key',
    ACCESS_TOKEN: 'Access Token',
  },
  PROGRESS: {
    WAITING_AUTH: (name: string) => `Waiting for ${name} authorization...`,
  }
} as const;

export const UI_MESSAGES = {
  REFRESHING: 'Refreshing usage...',
  NO_ACTIVE_ACCOUNT: {
    TITLE: 'No Active Account',
    DESCRIPTION: 'Click icon buttons in the top right to manage accounts',
  },
  ACCOUNT: {
    LOGOUT_CONFIRM: (provider: string, account: string) => `Are you sure you want to logout from ${provider} - ${account}?`,
    LOGGED_OUT: (provider: string, account: string) => `Logged out from ${provider} - ${account}`,
  },
  USAGE_ITEM: {
    RESET_TEMPLATE: 'Resets in {{TIME}}',
    RESETTING: 'Resetting...',
  }
} as const;
