import * as vscode from 'vscode';
import { UsageManager } from '../managers/UsageManager';
import { Provider, Account, UsageCategory } from '../types';

/**
 * UsageViewProvider - 侧边栏 Webview 面板
 * 
 * 功能：
 * 1. 显示所有 Provider 的用量数据
 * 2. 支持多账号显示
 * 3. 提供刷新和管理账号按钮
 */
export class UsageViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'unifyQuota.quotaView';

    private _view?: vscode.WebviewView;
    private _isRefreshing = false;
    private _hasLoadedOnce = false;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _usageManager: UsageManager
    ) {
        // 监听用量更新
        this._usageManager.onDidUpdateUsage(() => {
            this._updateHtml();
        });

        // 监听刷新状态变化
        this._usageManager.onDidRefreshStateChange((isRefreshing) => {
            this._isRefreshing = isRefreshing;
            if (!isRefreshing) {
                this._hasLoadedOnce = true;
            }
            this._updateHtml();
        });
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _context: vscode.WebviewViewResolveContext,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        this._updateHtml();
    }

    private _updateHtml() {
        if (this._view) {
            this._view.webview.html = this._getHtmlForWebview(this._view.webview);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private _getHtmlForWebview(webview: vscode.Webview): string {
        const providers = this._usageManager.getProviders();
        const hasAccounts = providers.some(p => p.accounts && Array.isArray(p.accounts) && p.accounts.length > 0);
        const hasStoredAccounts = this._usageManager.hasStoredAccounts();
        const locale = vscode.env.language || 'en';
        
        // 如果是初始加载中且有存储的账号，不显示 empty state
        const isLoading = this._isRefreshing || !this._hasLoadedOnce;
        const shouldShowEmpty = !hasAccounts && !isLoading && !hasStoredAccounts;

        return `<!DOCTYPE html>
        <html lang="${locale}">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Quota</title>
            <style>
                * {
                    box-sizing: border-box;
                }
                body {
                    padding: 0;
                    margin: 0;
                    color: var(--vscode-foreground);
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    line-height: 1.6;
                    background-color: transparent;
                }
                
                .container {
                    display: flex;
                    flex-direction: column;
                    height: 100vh;
                }
                
                .content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 0 1em 1em 1em;
                    display: flex;
                    flex-direction: column;
                }

                .provider-section {
                    margin-bottom: 1.2em;
                    border-bottom: 1px solid var(--vscode-panel-border);
                    padding-bottom: 1em;
                }
                
                .provider-section:last-child {
                    margin-bottom: 0;
                    border-bottom: none;
                }
                
                .provider-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.5em 0;
                    font-weight: 600;
                    font-size: 0.95em;
                    color: var(--vscode-foreground);
                    margin-bottom: 0.5em;
                }
                
                .account-block {
                    margin-bottom: 0.8em;
                    padding: 0.6em;
                    background: var(--vscode-editor-background);
                    border-radius: 3px;
                }
                
                .account-label {
                    font-size: 0.85em;
                    color: var(--vscode-descriptionForeground);
                    margin-bottom: 0.4em;
                    font-weight: 500;
                }
                
                .usage-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
                    gap: 0.6em;
                }
                
                .usage-item {
                    padding: 0.2em 0;
                }
                
                .usage-title {
                    display: flex;
                    justify-content: space-between;
                    align-items: baseline;
                    margin-bottom: 0.3em;
                    font-size: 0.85em;
                }
                
                .usage-name {
                    font-weight: 500;
                }
                
                .usage-value {
                    font-size: 0.9em;
                    color: var(--vscode-charts-blue);
                    font-weight: 600;
                }
                
                .progress-bar-container {
                    height: 4px;
                    background-color: var(--vscode-scrollbarSlider-background);
                    border-radius: 2px;
                    overflow: hidden;
                    margin-bottom: 0.2em;
                }
                
                .progress-bar {
                    height: 100%;
                    background-color: var(--vscode-charts-blue);
                    transition: width 0.2s ease;
                }
                
                .progress-bar.warning {
                    background-color: var(--vscode-charts-yellow);
                }
                
                .progress-bar.danger {
                    background-color: var(--vscode-charts-red);
                }
                
                .usage-reset {
                    font-size: 0.75em;
                    color: var(--vscode-descriptionForeground);
                    opacity: 0.8;
                    text-align: right;
                }
                
                .empty-state {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    padding: 2em 1.5em;
                    color: var(--vscode-descriptionForeground);
                    user-select: none;
                    -webkit-user-select: none;
                    cursor: default;
                }
                
                .empty-state-icon {
                    margin-bottom: 8px;
                    color: var(--vscode-editor-foreground);
                    display: flex;
                    justify-content: center;
                }
                
                .empty-state-icon svg {
                    width: 60px;
                    height: 60px;
                }
                
                .empty-state-title {
                    font-size: 1.6em;
                    font-weight: 500;
                    margin-bottom: 4px;
                    color: var(--vscode-editor-foreground);
                }

                .empty-state-description {
                    font-size: 1em;
                    color: var(--vscode-descriptionForeground);
                    line-height: 1.5;
                    max-width: 320px;
                    margin: 0 auto;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="content">
                    ${hasAccounts || isLoading ? this._renderProviders(providers) : this._renderEmptyState()}
                </div>
            </div>
        </body>
        </html>`;
    }

    private _renderEmptyState(): string {
        const locale = vscode.env.language || 'en';
        const title = locale === 'zh-cn' ? '暂无活跃账号' : 'No Active Account';
        const description = locale === 'zh-cn'
            ? '点击右上角图标按钮管理账号'
            : 'Click the icon buttons in the top right to manage accounts';

        const svg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 20V10" />
            <path d="M12 20V4" />
            <path d="M6 20V14" />
        </svg>`;

        return `
            <div class="empty-state">
                <div class="empty-state-icon">${svg}</div>
                <div class="empty-state-title">${title}</div>
                <div class="empty-state-description">${description}</div>
            </div>
        `;
    }

    private _renderProviders(providers: Provider[]): string {
        const locale = vscode.env.language || 'en';
        return providers
            .filter(p => p.accounts && Array.isArray(p.accounts) && p.accounts.length > 0)
            .map(p => this._renderProvider(p, locale))
            .join('');
    }

    private _renderProvider(provider: Provider, locale: string): string {
        const accounts = Array.isArray(provider.accounts) ? provider.accounts : [];
        const hasMultipleAccounts = accounts.length > 1;
        return `
            <div class="provider-section">
                <div class="provider-header">
                    <span>${provider.name}</span>
                </div>
                ${accounts.map(acc => this._renderAccount(acc, locale, hasMultipleAccounts)).join('')}
            </div>
        `;
    }

    private _renderAccount(account: Account, locale: string, showLabel: boolean): string {
        const accountLabel = account.alias || account.id;

        if (!showLabel) {
            return `
                <div class="account-block">
                    <div class="usage-grid">
                        ${account.usage.map(u => this._renderUsageItem(u, locale)).join('')}
                    </div>
                </div>
            `;
        }

        return `
            <div class="account-block">
                <div class="account-label">${accountLabel}</div>
                <div class="usage-grid">
                    ${account.usage.map(u => this._renderUsageItem(u, locale)).join('')}
                </div>
            </div>
        `;
    }

    private _renderUsageItem(usage: UsageCategory, locale: string): string {
        const percentage = usage.total > 0 ? (usage.used / usage.total) : 0;
        const usedPercent = Math.min(100, Math.round(percentage * 100));

        let statusColorClass = '';
        if (usedPercent >= 90) {
            statusColorClass = 'danger';
        } else if (usedPercent >= 75) {
            statusColorClass = 'warning';
        }

        let displayValue = '';
        if (usage.percentageOnly) {
            displayValue = `${usedPercent}%`;
        } else if (usage.limitType === 'token') {
            displayValue = `${(usage.used / 1000000).toFixed(1)}M / ${(usage.total / 1000000).toFixed(1)}M`;
        } else {
            const unit = usage.limitType === 'request'
                ? (locale === 'zh-cn' ? ' 次' : ' requests')
                : (locale === 'zh-cn' ? ' 点' : ' credits');
            displayValue = `${usage.used} / ${usage.total}${unit}`;
        }

        let resetHtml = '';
        if (usage.resetTime) {
            const date = new Date(usage.resetTime);
            const now = new Date();
            const diffMs = date.getTime() - now.getTime();
            let resetText = '';
            if (diffMs > 0) {
                const hours = Math.floor(diffMs / 3600000);
                const mins = Math.floor((diffMs % 3600000) / 60000);
                if (locale === 'zh-cn') {
                    resetText = hours > 0 ? `${hours}h${mins}m 后重置` : `${mins}m 后重置`;
                } else {
                    resetText = hours > 0 ? `Resets in ${hours}h${mins}m` : `Resets in ${mins}m`;
                }
            } else {
                resetText = locale === 'zh-cn' ? '重置中...' : 'Resetting...';
            }
            resetHtml = `<div class="usage-reset">${resetText}</div>`;
        }

        return `
            <div class="usage-item">
                <div class="usage-title">
                    <span class="usage-name">${usage.name}</span>
                    <span class="usage-value">${displayValue}</span>
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar ${statusColorClass}" style="width: ${usedPercent}%"></div>
                </div>
                ${resetHtml}
            </div>
        `;
    }
}
