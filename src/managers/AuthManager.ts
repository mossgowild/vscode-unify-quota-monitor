import * as vscode from 'vscode';
import * as http from 'http';
import * as crypto from 'crypto';
import { UsageManager } from './UsageManager';
import { ProviderId, StoredAccount } from '../types';
import { getProviderDefinitions, getProviderDefinition } from '../utils/providers';
import {
    generateAccountId,
    getAccount,
    getAccountsByProvider,
    saveAccount,
    deleteAccount,
    getStoredAccounts
} from '../utils/config';

interface MenuItem extends vscode.QuickPickItem {
    action?: string;
    accountId?: string;
    providerId?: ProviderId;
    kind?: vscode.QuickPickItemKind;
}

export class AuthManager {
    private usageManager: UsageManager | undefined;

    // Google OAuth 配置
    private readonly googleAuthUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
    private readonly googleClientId = '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com';
    private readonly googleClientSecret = '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';
    private readonly googleRedirectUri = 'http://localhost:51121/oauth-callback';
    private readonly googleTokenUrl = 'https://oauth2.googleapis.com/token';
    private readonly googleScopes = [
        'openid',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/cloud-platform',
        'https://www.googleapis.com/auth/cclog',
        'https://www.googleapis.com/auth/experimentsandconfigs'
    ];
    private readonly googleCallbackPort = 51121;
    private readonly googleRedirectPath = '/oauth-callback';

    // OpenAI Codex OAuth 配置
    private readonly openaiClientId = 'app_EMoamEEZ73f0CkXaXp7hrann';
    private readonly openaiIssuer = 'https://auth.openai.com';
    private readonly openaiCallbackPort = 1455;
    private readonly openaiRedirectPath = '/auth/callback';
    private readonly openaiRedirectUri = `http://localhost:${this.openaiCallbackPort}${this.openaiRedirectPath}`;
    private readonly openaiScope = 'openid profile email offline_access';
    private readonly openaiOriginator = 'opencode';

    constructor() {
    }

    public setUsageManager(usageManager: UsageManager) {
        this.usageManager = usageManager;
    }

    /**
     * 显示账号管理 QuickPick 菜单
     * 
     * 菜单结构：
     * 区域1: 已登录账号列表 (如果有)
     *   - 点击账号 -> 进入二级菜单 (重新登录 / 退出登录)
     * 分割线
     * 区域2: 添加 Provider 按钮
     *   - 点击 -> 选择 Provider -> 登录流程
     */
    public async showAccountMenu(): Promise<void> {
        const items: MenuItem[] = [];
        const locale = vscode.env.language;
        const addProvider = locale === 'zh-cn' ? '添加 Provider' : 'Add Provider';
        const loginNew = locale === 'zh-cn' ? '登录新的 AI Provider' : 'Login to new AI Provider';
        const title = locale === 'zh-cn' ? '管理账号' : 'Manage Accounts';
        const placeHolder = locale === 'zh-cn' ? '管理账号或添加新 Provider' : 'Manage accounts or add new Provider';

        // 区域1: 已登录账号
        const accounts = getStoredAccounts();
        if (accounts.length > 0) {
            for (const account of accounts) {
                const providerDef = getProviderDefinition(account.providerId);
                const accountLabel = account.alias || account.id;
                items.push({
                    label: `${providerDef?.name || account.providerId} - ${accountLabel}`,
                    description: '',
                    action: 'manageAccount',
                    accountId: account.id,
                    providerId: account.providerId
                });
            }

            // 添加分割线
            items.push({
                label: '',
                kind: vscode.QuickPickItemKind.Separator
            } as any);
        }

        // 区域2: 添加 Provider
        items.push({
            label: `$(plus) ${addProvider}`,
            description: loginNew,
            action: 'addProvider'
        });

        const selected = await vscode.window.showQuickPick(items, {
            title,
            placeHolder
        });

        if (!selected) {
            return;
        }

        if (selected.action === 'addProvider') {
            await this.addProviderAccount();
        } else if (selected.action === 'manageAccount' && selected.accountId) {
            await this.showAccountActions(selected.accountId);
        }
    }

    /**
     * 显示账号操作二级菜单
     * - 设置别名
     * - 重新登录
     * - 退出登录
     */
    private async showAccountActions(accountId: string): Promise<void> {
        const account = getAccount(accountId);
        if (!account) {
            return;
        }

        const locale = vscode.env.language;
        const providerDef = getProviderDefinition(account.providerId);
        const accountLabel = account.alias || accountId;

        const back = locale === 'zh-cn' ? '返回' : 'Back';
        const setAlias = locale === 'zh-cn' ? '设置别名' : 'Set Alias';
        const setAliasDesc = locale === 'zh-cn' ? '修改账号别名' : 'Modify account alias';
        const relogin = locale === 'zh-cn' ? '重新登录' : 'Relogin';
        const reloginDesc = locale === 'zh-cn' ? '更新此账号的认证凭证' : 'Update this account\'s credentials';
        const logout = locale === 'zh-cn' ? '退出登录' : 'Logout';
        const logoutDesc = locale === 'zh-cn' ? '删除此账号' : 'Delete this account';
        const selectAction = locale === 'zh-cn' ? '选择操作' : 'Select action';

        const items: (vscode.QuickPickItem & { action?: string })[] = [
            {
                label: `$(arrow-left) ${back}`,
                action: 'back'
            },
            {
                label: '',
                kind: vscode.QuickPickItemKind.Separator
            } as any,
            {
                label: `$(pencil) ${setAlias}`,
                description: setAliasDesc,
                action: 'setAlias'
            },
            {
                label: `$(sign-in) ${relogin}`,
                description: reloginDesc,
                action: 'relogin'
            },
            {
                label: `$(sign-out) ${logout}`,
                description: logoutDesc,
                action: 'logout'
            }
        ];

        const selected = await vscode.window.showQuickPick(items, {
            title: `${providerDef?.name || account.providerId} - ${accountLabel}`,
            placeHolder: selectAction
        });

        if (!selected) {
            return;
        }

        if (selected.action === 'back') {
            await this.showAccountMenu();
        } else if (selected.action === 'setAlias') {
            await this.setAccountAlias(accountId);
        } else if (selected.action === 'relogin') {
            await this.reloginAccount(accountId);
        } else if (selected.action === 'logout') {
            await this.logoutAccount(accountId);
        }
    }

    /**
     * 设置账号别名
     */
    private async setAccountAlias(accountId: string): Promise<void> {
        const account = getAccount(accountId);
        if (!account) {
            return;
        }

        const locale = vscode.env.language;
        const title = locale === 'zh-cn' ? '账号别名' : 'Account Alias';
        const prompt = locale === 'zh-cn' ? '为此账号设置一个别名' : 'Set an alias for this account';
        const currentAlias = locale === 'zh-cn' ? '当前别名' : 'Current alias';

        const alias = await vscode.window.showInputBox({
            title,
            prompt,
            value: account.alias || '',
            placeHolder: `${currentAlias}: ${account.alias || locale === 'zh-cn' ? '无' : 'None'}`
        });

        if (alias === undefined) {
            return;
        }

        const updatedAccount: StoredAccount = {
            id: account.id,
            providerId: account.providerId,
            alias: alias || undefined,
            credential: account.credential
        };

        await saveAccount(updatedAccount);

        if (this.usageManager) {
            await this.usageManager.refresh(account.providerId);
        }

        await this.showAccountActions(accountId);
    }

    /**
     * 添加新的 Provider 账号
     */
    private async addProviderAccount(): Promise<void> {
        // if (!this.usageManager) {
        //     return;
        // }

        const locale = vscode.env.language;
        // const providers = this.usageManager.getProviders();
        const providers = getProviderDefinitions();
        const items = providers.map(p => ({
            label: p.name,
            description: p.auth.type === 'oauth' ? 'OAuth Login' : p.auth.type === 'key' ? 'API Key' : 'Access Token',
            providerId: p.id
        }));

        const title = locale === 'zh-cn' ? '选择 Provider' : 'Select Provider';
        const placeHolder = locale === 'zh-cn' ? '选择要添加的 AI Provider' : 'Select AI Provider to add';

        const selected = await vscode.window.showQuickPick(items, {
            title,
            placeHolder
        });

        if (!selected) {
            return;
        }

        await this.loginProvider(selected.providerId);
    }

    /**
     * 登录指定 Provider
     */
    public async loginProvider(providerId: ProviderId, accountId?: string): Promise<void> {
        // const provider = this.usageManager?.getProviders().find(p => p.id === providerId);
        const providerDef = getProviderDefinition(providerId);
        if (!providerDef) {
            return;
        }

        const locale = vscode.env.language;

        // Google OAuth 特殊处理
        if (providerId === 'google' && providerDef.auth.type === 'oauth') {
            await this.loginWithGoogle(accountId);
            return;
        }

        // OpenAI OAuth 特殊处理
        if (providerId === 'openai') {
            const oauthLabel = locale === 'zh-cn' ? 'OAuth 登录 (推荐)' : 'OAuth Login (Recommended)';
            const tokenLabel = locale === 'zh-cn' ? 'Access Token' : 'Access Token';
            const oauthDesc = locale === 'zh-cn' ? '适用于 ChatGPT Plus/Pro' : 'For ChatGPT Plus/Pro';
            const tokenDesc = locale === 'zh-cn' ? '手动输入 JWT Token' : 'Manually enter JWT Token';
            const selectMethod = locale === 'zh-cn' ? '选择登录方式' : 'Select Login Method';

            const method = await vscode.window.showQuickPick(
                [
                    { label: oauthLabel, description: oauthDesc, detail: 'oauth' },
                    { label: tokenLabel, description: tokenDesc, detail: 'token' }
                ],
                { placeHolder: selectMethod }
            );
            
            if (!method) { return; }
            
            if (method.detail === 'oauth') {
                await this.loginWithOpenAI(accountId);
                return;
            }
        }

        const loginTo = locale === 'zh-cn' ? '登录到' : 'Login to';
        const enterCredential = locale === 'zh-cn'
            ? `输入 ${providerDef.name} 的认证凭证`
            : `Enter ${providerDef.name} credentials`;

        const credential = await vscode.window.showInputBox({
            title: `${loginTo} ${providerDef.name}`,
            prompt: providerDef.auth.placeholder || enterCredential,
            password: true,
            ignoreFocusOut: true
        });

        if (!credential) {
            return;
        }

        const newAccountId = accountId || generateAccountId(providerId);
        const account: StoredAccount = {
            id: newAccountId,
            providerId,
            credential
        };

        const successMsg = locale === 'zh-cn'
            ? `已成功登录到 ${providerDef.name}`
            : `Successfully logged in to ${providerDef.name}`;

        await this.saveAccountWithAlias(account, providerDef.name, successMsg);
    }

    /**
     * 重新登录账号
     */
    private async reloginAccount(accountId: string): Promise<void> {
        const account = getAccount(accountId);
        if (!account) {
            return;
        }
        await this.loginProvider(account.providerId, accountId);
        await this.showAccountMenu();
    }

    /**
     * 退出登录账号
     */
    private async logoutAccount(accountId: string): Promise<void> {
        const account = getAccount(accountId);
        if (!account) {
            return;
        }

        const locale = vscode.env.language;
        const provider = this.usageManager?.getProviders().find(p => p.id === account.providerId);
        const accountLabel = account.alias || accountId;

        const confirmMsg = locale === 'zh-cn'
            ? `确定要退出 ${provider?.name || account.providerId} 的 ${accountLabel} 吗？`
            : `Are you sure you want to logout from ${provider?.name || account.providerId} - ${accountLabel}?`;
        const confirm = locale === 'zh-cn' ? '确定' : 'Confirm';
        const cancel = locale === 'zh-cn' ? '取消' : 'Cancel';

        const confirmAction = await vscode.window.showWarningMessage(
            confirmMsg,
            confirm,
            cancel
        );

        if (confirmAction !== confirm) {
            await this.showAccountMenu();
            return;
        }

        await deleteAccount(accountId);
        const logoutMsg = locale === 'zh-cn'
            ? `已退出 ${provider?.name || account.providerId} - ${accountLabel}`
            : `Logged out from ${provider?.name || account.providerId} - ${accountLabel}`;
        vscode.window.showInformationMessage(logoutMsg);

        // 刷新用量
        if (this.usageManager) {
            await this.usageManager.refresh(account.providerId);
        }

        await this.showAccountMenu();
    }

    /**
     * Google OAuth 登录流程
     */
    private async loginWithGoogle(existingAccountId?: string): Promise<void> {
        const state = Math.random().toString(36).substring(7);
        const authUrl = new URL(this.googleAuthUrl);
        authUrl.searchParams.set('client_id', this.googleClientId);
        authUrl.searchParams.set('redirect_uri', this.googleRedirectUri);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', this.googleScopes.join(' '));
        authUrl.searchParams.set('state', state);
        authUrl.searchParams.set('access_type', 'offline');
        authUrl.searchParams.set('prompt', 'consent');

        await vscode.env.openExternal(vscode.Uri.parse(authUrl.toString()));

        const locale = vscode.env.language;
        const waitingAuth = locale === 'zh-cn'
            ? "等待 Google 授权中..."
            : "Waiting for Google authorization...";
        const authSuccess = locale === 'zh-cn'
            ? '认证成功！您可以关闭此标签页并返回 VS Code。'
            : 'Authentication successful! You can close this tab and return to VS Code.';
        const authFailed = locale === 'zh-cn' ? '认证失败' : 'Authentication failed';
        const noRefreshToken = locale === 'zh-cn' ? '未返回 refresh token' : 'No refresh token returned';
        const loginSuccess = locale === 'zh-cn'
            ? '已成功登录到 Google Antigravity'
            : 'Successfully logged in to Google Antigravity';

        const result = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: waitingAuth,
            cancellable: true
        }, async (progress, token) => {
            return new Promise<string | null>((resolve) => {
                const server = http.createServer(async (req, res) => {
                    const url = new URL(req.url || '', `http://localhost:${this.googleCallbackPort}`);
                    if (url.pathname !== this.googleRedirectPath) {
                        res.statusCode = 404;
                        res.end('Not Found');
                        return;
                    }

                    const code = url.searchParams.get('code');
                    const returnedState = url.searchParams.get('state');

                    if (returnedState !== state) {
                        res.end('Invalid state. Please try again.');
                        return;
                    }

                    if (code) {
                        res.end(authSuccess);
                        server.close();
                        resolve(code);
                    }
                });

                server.on('error', () => {
                    server.close();
                    resolve(null); // 回退到手动输入
                });

                server.listen(this.googleCallbackPort);

                token.onCancellationRequested(() => {
                    server.close();
                    resolve(null);
                });
            });
        });

        let finalCode = result;
        if (result === null) {
            vscode.window.showErrorMessage(authFailed);
            return;
        }

        if (finalCode) {
            try {
                const tokens = await this.exchangeCodeForToken(finalCode);
                if (tokens.refresh_token) {
                    const accountId = existingAccountId || generateAccountId('google');
                    const account: StoredAccount = {
                        id: accountId,
                        providerId: 'google',
                        credential: tokens.refresh_token
                    };

                    await this.saveAccountWithAlias(account, 'Google Antigravity', loginSuccess);
                } else {
                    throw new Error(noRefreshToken);
                }
            } catch (err: any) {
                vscode.window.showErrorMessage(`${authFailed}: ${err.message}`);
            }
        }
    }

    /**
     * 交换授权码获取 Token
     */
    private async exchangeCodeForToken(code: string): Promise<any> {
        const params = new URLSearchParams();
        params.set('client_id', this.googleClientId);
        params.set('client_secret', this.googleClientSecret);
        params.set('code', code);
        params.set('grant_type', 'authorization_code');
        params.set('redirect_uri', this.googleRedirectUri);

        const headers = new Headers();
        headers.set('Content-Type', 'application/x-www-form-urlencoded');
        
        const response = await fetch(this.googleTokenUrl, {
            method: 'POST',
            headers,
            body: params.toString()
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`交换授权码失败: ${error}`);
        }

        return response.json();
    }

    /**
     * OpenAI OAuth 登录流程
     */
    private async loginWithOpenAI(existingAccountId?: string): Promise<void> {
        const { verifier, challenge } = this.generatePkce();
        const state = this.generateRandomString(32);
        
        const url = new URL(`${this.openaiIssuer}/oauth/authorize`);
        url.searchParams.set('response_type', 'code');
        url.searchParams.set('client_id', this.openaiClientId);
        url.searchParams.set('redirect_uri', this.openaiRedirectUri);
        url.searchParams.set('scope', this.openaiScope);
        url.searchParams.set('code_challenge', challenge);
        url.searchParams.set('code_challenge_method', 'S256');
        url.searchParams.set('id_token_add_organizations', 'true');
        url.searchParams.set('codex_cli_simplified_flow', 'true');
        url.searchParams.set('state', state);
        url.searchParams.set('originator', this.openaiOriginator);

        await vscode.env.openExternal(vscode.Uri.parse(url.toString()));

        const locale = vscode.env.language;
        const waitingAuth = locale === 'zh-cn' ? "等待 OpenAI 授权中..." : "Waiting for OpenAI authorization...";
        const authSuccess = locale === 'zh-cn' ? '认证成功！' : 'Authentication successful!';
        const loginSuccess = locale === 'zh-cn' ? '已成功登录到 OpenAI Codex' : 'Successfully logged in to OpenAI Codex';
        const authFailed = locale === 'zh-cn' ? '认证失败' : 'Authentication failed';

        const result = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: waitingAuth,
            cancellable: true
        }, async (progress, token) => {
            return new Promise<string | null>((resolve) => {
                const server = http.createServer(async (req, res) => {
                    const url = new URL(req.url || '', `http://localhost:${this.openaiCallbackPort}`);
                    if (url.pathname !== this.openaiRedirectPath) {
                        res.statusCode = 404;
                        res.end('Not Found');
                        return;
                    }

                    const code = url.searchParams.get('code');
                    const returnedState = url.searchParams.get('state');

                    if (returnedState !== state) {
                        res.end('Invalid state. Please try again.');
                        return;
                    }

                    if (code) {
                        res.end(authSuccess);
                        server.close();
                        resolve(code);
                    }
                });

                server.on('error', () => {
                    server.close();
                    resolve(null);
                });

                server.listen(this.openaiCallbackPort);

                token.onCancellationRequested(() => {
                    server.close();
                    resolve(null);
                });
            });
        });

        if (result) {
            try {
                const tokens = await this.exchangeOpenAICodexCode(result, verifier);
                if (tokens.access_token) {
                    const accountId = existingAccountId || generateAccountId('openai');
                    const account: StoredAccount = {
                        id: accountId,
                        providerId: 'openai',
                        // 存储整个 token 对象或者只是 access_token？
                        // UsageManager 目前期望的是 access_token 字符串。
                        // 但是为了支持 refresh，我们应该存储 refresh_token。
                        // 这里我们暂时只存 access_token，因为 current UsageManager 只用 access_token。
                        // 不过如果后续要支持 refresh，需要修改 Account 结构或者把 json 存进去。
                        // 参考仓库是存了 JSON string。这里我们也存 JSON string，然后在 UsageManager 里解析。
                        credential: JSON.stringify({
                            accessToken: tokens.access_token,
                            refreshToken: tokens.refresh_token,
                            expiresIn: tokens.expires_in,
                            tokenType: tokens.token_type
                        })
                    };

                    await this.saveAccountWithAlias(account, 'OpenAI Codex', loginSuccess);
                }
            } catch (err: any) {
                vscode.window.showErrorMessage(`${authFailed}: ${err.message}`);
            }
        }
    }

    private async exchangeOpenAICodexCode(code: string, verifier: string): Promise<any> {
        const params = new URLSearchParams();
        params.set('grant_type', 'authorization_code');
        params.set('code', code);
        params.set('redirect_uri', this.openaiRedirectUri);
        params.set('client_id', this.openaiClientId);
        params.set('code_verifier', verifier);

        const headers = new Headers();
        headers.set('Content-Type', 'application/x-www-form-urlencoded');
        
        const response = await fetch(`${this.openaiIssuer}/oauth/token`, {
            method: 'POST',
            headers,
            body: params.toString()
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenAI Token Exchange Failed: ${error}`);
        }

        return response.json();
    }

    private generateRandomString(length: number): string {
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
        let out = '';
        const bytes = crypto.randomBytes(length);
        for (let i = 0; i < length; i++) {
            out += charset[bytes[i] % charset.length];
        }
        return out;
    }

    private generatePkce() {
        const verifier = this.generateRandomString(43);
        const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
        return { verifier, challenge };
    }

    /**
     * 检查账号是否已登录
     */
    public async hasAccounts(providerId: ProviderId): Promise<boolean> {
        const accounts = getAccountsByProvider(providerId);
        return accounts.length > 0;
    }

    /**
     * 获取 Provider 的所有账号
     */
    public async getProviderAccounts(providerId: ProviderId): Promise<StoredAccount[]> {
        return getAccountsByProvider(providerId);
    }

    /**
     * 辅助方法：设置别名并保存账号
     */
    private async saveAccountWithAlias(
        account: StoredAccount,
        providerName: string,
        successMsg: string
    ): Promise<void> {
        const locale = vscode.env.language;
        
        // 如果账号已有别名（比如重新登录时保留了原别名），则作为默认值
        // 但目前的逻辑是重新登录也会重新走一遍流程，所以这里总是询问
        const alias = await vscode.window.showInputBox({
            title: locale === 'zh-cn' ? '账号别名 (可选)' : 'Account Alias (Optional)',
            prompt: locale === 'zh-cn'
                ? '为此账号设置一个别名以便区分多个账号'
                : 'Set an alias for this account to distinguish multiple accounts',
            placeHolder: locale === 'zh-cn' ? '例如: Work、Personal、Team 等' : 'e.g. Work, Personal, Team, etc.',
            value: account.alias || ''
        });

        if (alias) {
            account.alias = alias;
        }

        await saveAccount(account);
        vscode.window.showInformationMessage(successMsg);

        // 刷新用量
        if (this.usageManager) {
            await this.usageManager.refresh(account.providerId);
        }
    }
}
