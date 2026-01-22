import * as vscode from 'vscode';
import { StoredAccount, AutoRefreshConfig } from '../types';

const CONFIG_KEY_ACCOUNTS = 'accounts';
const CONFIG_KEY_AUTOREFRESH = 'autoRefresh';

export function getStoredAccounts(): StoredAccount[] {
    const config = vscode.workspace.getConfiguration('unifyQuota');
    const accounts = config.get<StoredAccount[]>(CONFIG_KEY_ACCOUNTS);
    return Array.isArray(accounts) ? accounts : [];
}

export async function saveAccount(account: StoredAccount): Promise<void> {
    const accounts = getStoredAccounts();
    const index = accounts.findIndex(a => a.id === account.id);
    
    if (index >= 0) {
        accounts[index] = account;
    } else {
        accounts.push(account);
    }
    
    const config = vscode.workspace.getConfiguration('unifyQuota');
    await config.update(CONFIG_KEY_ACCOUNTS, accounts, vscode.ConfigurationTarget.Global);
}

export async function deleteAccount(accountId: string): Promise<void> {
    const accounts = getStoredAccounts().filter(a => a.id !== accountId);
    const config = vscode.workspace.getConfiguration('unifyQuota');
    await config.update(CONFIG_KEY_ACCOUNTS, accounts, vscode.ConfigurationTarget.Global);
}

export function getAccount(accountId: string): StoredAccount | undefined {
    return getStoredAccounts().find(a => a.id === accountId);
}

export function getAccountsByProvider(providerId: string): StoredAccount[] {
    return getStoredAccounts().filter(a => a.providerId === providerId);
}

export function generateAccountId(providerId: string): string {
    return `${providerId}-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

export function getAutoRefreshConfig(): AutoRefreshConfig {
    const config = vscode.workspace.getConfiguration('unifyQuota');
    return config.get<AutoRefreshConfig>(CONFIG_KEY_AUTOREFRESH) || {
        enabled: true,
        intervalMs: 60000
    };
}

export async function setAutoRefreshConfig(config: AutoRefreshConfig): Promise<void> {
    const vscodeConfig = vscode.workspace.getConfiguration('unifyQuota');
    await vscodeConfig.update(CONFIG_KEY_AUTOREFRESH, config, vscode.ConfigurationTarget.Global);
}
