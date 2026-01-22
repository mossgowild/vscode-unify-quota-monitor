import * as vscode from 'vscode';
import { Provider, UsageCategory, Account, ProviderId, StoredAccount } from '../types';
import { AuthManager } from './AuthManager';
import { getAccountsByProvider, getAutoRefreshConfig, saveAccount } from '../utils/config';
import { getProviderDefinitions } from '../utils/providers';

/**
 * UsageManager - 用量数据管理
 * 
 * 职责：
 * 1. 初始化 Provider 定义
 * 2. 从各 Provider API 获取用量数据
 * 3. 支持多账号并行获取用量
 * 4. 触发 UI 更新事件
 */
export class UsageManager {
    private providers: Map<ProviderId, Provider> = new Map();
    private authManager: AuthManager;
    private refreshTimer: NodeJS.Timeout | undefined;
    private isRefreshing = false;

    private _onDidUpdateUsage = new vscode.EventEmitter<void>();
    public readonly onDidUpdateUsage = this._onDidUpdateUsage.event;

    private _onDidRefreshStateChange = new vscode.EventEmitter<boolean>();
    public readonly onDidRefreshStateChange = this._onDidRefreshStateChange.event;

    constructor(authManager: AuthManager) {
        this.authManager = authManager;
        this.initProviders();
    }

    public startAutoRefresh(): void {
        this.stopAutoRefresh();
        const config = getAutoRefreshConfig();
        if (config.enabled) {
            this.refreshTimer = setInterval(() => {
                this.refresh();
            }, config.intervalMs);
        }
    }

    public stopAutoRefresh(): void {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = undefined;
        }
    }

    /**
     * 检查是否有存储的账号配置
     */
    public hasStoredAccounts(): boolean {
        const definitions = getProviderDefinitions();
        for (const def of definitions) {
            const accounts = getAccountsByProvider(def.id);
            if (accounts.length > 0) {
                return true;
            }
        }
        return false;
    }

    /**
     * 初始化 Provider 定义
     */
    private initProviders() {
        const definitions = getProviderDefinitions();
        for (const def of definitions) {
            this.providers.set(def.id, {
                ...def,
                accounts: []
            });
        }
    }

    /**
     * 刷新用量数据
     * @param providerId 可选，指定只刷新某个 Provider
     */
    public async refresh(providerId?: ProviderId) {
        if (this.isRefreshing) {
            return;
        }

        this.isRefreshing = true;
        this._onDidRefreshStateChange.fire(true);

        const locale = vscode.env.language || 'en';
        const title = locale === 'zh-cn' ? '正在刷新用量...' : 'Refreshing usage...';

        try {
            await vscode.window.withProgress({
                location: { viewId: 'unifyQuota.usageView' },
                title
            }, async () => {
                if (providerId) {
                    await this.refreshProvider(providerId);
                } else {
                    // 刷新所有 Provider
                    const promises = Array.from(this.providers.keys()).map(id => this.refreshProvider(id));
                    await Promise.allSettled(promises);
                }
            });
            this._onDidUpdateUsage.fire();
        } finally {
            this.isRefreshing = false;
            this._onDidRefreshStateChange.fire(false);
        }
    }

    /**
     * 刷新指定 Provider 的所有账号
     */
    private async refreshProvider(providerId: ProviderId) {
        const provider = this.providers.get(providerId);
        if (!provider) {
            return;
        }

        const storedAccounts = getAccountsByProvider(providerId);

        provider.accounts = [];

        const promises = storedAccounts.map(stored => this.fetchAccountUsage(provider, stored));
        const results = await Promise.allSettled(promises);

        for (const result of results) {
            if (result.status === 'fulfilled' && result.value) {
                provider.accounts.push(result.value);
            }
        }
    }

    /**
     * 获取单个账号的用量数据
     */
    private async fetchAccountUsage(provider: Provider, storedAccount: StoredAccount): Promise<Account | null> {
        try {
            let usage: UsageCategory[] = [];
            const locale = vscode.env.language;

            if (provider.id === 'openai') {
                usage = await this.fetchOpenAIUsage(storedAccount, locale);
            } else if (provider.id === 'zhipu' || provider.id === 'zai') {
                usage = await this.fetchZhipuUsage(provider.id, storedAccount.credential, locale);
            } else if (provider.id === 'google') {
                usage = await this.fetchGoogleUsage(storedAccount.credential);
            }

            return {
                id: storedAccount.id,
                alias: storedAccount.alias,
                credential: storedAccount.credential,
                usage,
                lastUpdated: new Date().toISOString()
            };
        } catch (err) {
            console.error(`Failed to fetch usage for account ${storedAccount.id}:`, err);
            return {
                id: storedAccount.id,
                alias: storedAccount.alias,
                credential: storedAccount.credential,
                usage: [],
                lastUpdated: new Date().toISOString()
            };
        }
    }

    /**
     * 获取 OpenAI 用量
     */
    private async fetchOpenAIUsage(account: StoredAccount, locale: string): Promise<UsageCategory[]> {
        let token = account.credential;
        let refreshToken = '';
        
        try {
            const json = JSON.parse(account.credential);
            if (json.accessToken) {
                token = json.accessToken;
                refreshToken = json.refreshToken;
            }
        } catch (e) {
            // Not a JSON, treat as raw token
        }

        const headers = new Headers();
        headers.set('Authorization', `Bearer ${token}`);
        headers.set('User-Agent', 'UnifyQuotaMonitor/1.0');

        let response = await fetch('https://chatgpt.com/backend-api/wham/usage', {
            headers
        });

        // 尝试刷新 Token
        if (response.status === 401 && refreshToken) {
            try {
                const params = new URLSearchParams();
                params.set('grant_type', 'refresh_token');
                params.set('refresh_token', refreshToken);
                params.set('client_id', 'app_EMoamEEZ73f0CkXaXp7hrann');

                const refreshHeaders = new Headers();
                refreshHeaders.set('Content-Type', 'application/x-www-form-urlencoded');

                const refreshResponse = await fetch('https://auth.openai.com/oauth/token', {
                    method: 'POST',
                    headers: refreshHeaders,
                    body: params.toString()
                });

                if (refreshResponse.ok) {
                    const newData = await refreshResponse.json() as any;
                    token = newData.access_token;
                    
                    // 更新存储
                    const newCredential = JSON.stringify({
                        accessToken: newData.access_token,
                        refreshToken: newData.refresh_token || refreshToken,
                        expiresIn: newData.expires_in,
                        tokenType: newData.token_type
                    });
                    
                    await saveAccount({
                        ...account,
                        credential: newCredential
                    });

                    // 重试请求
                    headers.set('Authorization', `Bearer ${token}`);
                    response = await fetch('https://chatgpt.com/backend-api/wham/usage', { headers });
                }
            } catch (err) {
                console.error('OpenAI Token Refresh Failed:', err);
            }
        }

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status}`);
        }

        const data = await response.json() as any;
        const models: UsageCategory[] = [];

        if (data.rate_limit) {
            const formatWindowName = (seconds: number) => {
                const hours = Math.round(seconds / 3600);
                return locale === 'zh-cn' ? `${hours}小时限额` : `${hours}h Limit`;
            };

            if (data.rate_limit.primary_window) {
                const w = data.rate_limit.primary_window;
                models.push({
                    name: formatWindowName(w.limit_window_seconds),
                    limitType: 'request',
                    used: w.used_percent,
                    total: 100,
                    percentageOnly: true,
                    resetTime: new Date(Date.now() + w.reset_after_seconds * 1000).toISOString()
                });
            }

            if (data.rate_limit.secondary_window) {
                const w = data.rate_limit.secondary_window;
                models.push({
                    name: formatWindowName(w.limit_window_seconds),
                    limitType: 'request',
                    used: w.used_percent,
                    total: 100,
                    percentageOnly: true,
                    resetTime: new Date(Date.now() + w.reset_after_seconds * 1000).toISOString()
                });
            }
        }

        return models;
    }

    /**
     * 获取智谱 AI / Z.ai 用量
     */
    private async fetchZhipuUsage(providerId: 'zhipu' | 'zai', token: string, locale: string): Promise<UsageCategory[]> {
        const url = providerId === 'zhipu'
            ? 'https://bigmodel.cn/api/monitor/usage/quota/limit'
            : 'https://api.z.ai/api/monitor/usage/quota/limit';

        const headers = new Headers();
        headers.set('Authorization', token);
        headers.set('User-Agent', 'UnifyQuotaMonitor/1.0');

        const response = await fetch(url, {
            headers
        });

        if (!response.ok) {
            throw new Error(`${providerId} API error: ${response.status}`);
        }

        const data = await response.json() as any;
        const models: UsageCategory[] = [];

        if (data.success && data.data?.limits) {
            for (const l of data.data.limits) {
                let resetDate: Date | undefined;
                const rawResetTime = l.nextResetTime || l.next_reset_time || l.resetTime || l.reset_time;

                if (rawResetTime) {
                    const timestamp = Number(rawResetTime);
                    if (!isNaN(timestamp) && timestamp > 0) {
                        resetDate = new Date(timestamp);
                    } else {
                        resetDate = new Date(rawResetTime);
                    }
                }

                const tokenLimit = locale === 'zh-cn' ? 'Token 限额' : 'Token Limit';
                const mcpQuota = locale === 'zh-cn' ? 'MCP 配额' : 'MCP Quota';

                models.push({
                    name: l.type === 'TOKENS_LIMIT' ? tokenLimit : mcpQuota,
                    limitType: l.type === 'TOKENS_LIMIT' ? 'token' : 'request',
                    used: l.currentValue,
                    total: l.usage,
                    resetTime: resetDate ? resetDate.toISOString() : undefined
                });
            }
        }

        return models;
    }

    /**
     * 获取 Google Antigravity 用量
     */
    private async fetchGoogleUsage(refreshToken: string): Promise<UsageCategory[]> {
        // 刷新 Access Token
        const refreshParams = new URLSearchParams();
        refreshParams.set('client_id', '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com');
        refreshParams.set('client_secret', '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');
        refreshParams.set('refresh_token', refreshToken);
        refreshParams.set('grant_type', 'refresh_token');

        const headers1 = new Headers();
        headers1.set('Content-Type', 'application/x-www-form-urlencoded');

        const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: headers1,
            body: refreshParams.toString()
        });

        if (!refreshResponse.ok) {
            throw new Error('Google token refresh failed');
        }

        const tokenData = await refreshResponse.json() as any;
        const accessToken = tokenData.access_token;

        // 获取配额信息
        const headers2 = new Headers();
        headers2.set('Content-Type', 'application/json');
        headers2.set('Authorization', `Bearer ${accessToken}`);
        headers2.set('User-Agent', 'antigravity/1.11.9');

        const quotaResponse = await fetch('https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels', {
            method: 'POST',
            headers: headers2,
            body: JSON.stringify({ project: 'rising-fact-p41fc' })
        });

        if (!quotaResponse.ok) {
            throw new Error(`Google API error: ${quotaResponse.status}`);
        }

        const data = await quotaResponse.json() as any;
        const models: UsageCategory[] = [];
        const modelMap = new Map([
            ['gemini-3-pro-high', 'Gemini 3 Pro'],
            ['gemini-3-flash', 'Gemini 3 Flash'],
            ['gemini-3-pro-image', 'Gemini 3 Image'],
            ['claude-opus-4-5-thinking', 'Claude Opus']
        ]);

        for (const [key, label] of modelMap.entries()) {
            const m = data.models?.[key];
            if (m?.quotaInfo) {
                const remainingFraction = m.quotaInfo.remainingFraction ?? 0;
                models.push({
                    name: label,
                    limitType: 'request',
                    used: Math.round((1 - remainingFraction) * 100),
                    total: 100,
                    percentageOnly: true,
                    resetTime: m.quotaInfo.resetTime
                });
            }
        }

        return models;
    }

    /**
     * 获取所有 Provider 列表
     */
    public getProviders(): Provider[] {
        return Array.from(this.providers.values());
    }

    /**
     * 获取指定 Provider
     */
    public getProvider(providerId: ProviderId): Provider | undefined {
        return this.providers.get(providerId);
    }
}
