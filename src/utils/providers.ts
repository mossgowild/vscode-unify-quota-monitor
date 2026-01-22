import * as vscode from 'vscode';
import { Provider, ProviderId } from '../types';

/**
 * 获取 Provider 的静态定义（不包含运行时账号数据）
 */
export function getProviderDefinitions(): Omit<Provider, 'accounts'>[] {
    const locale = vscode.env.language;

    return [
        // OpenAI
        {
            id: 'openai',
            name: 'OpenAI',
            icon: 'symbol-event',
            auth: {
                required: true,
                loggedIn: false,
                type: 'token',
                placeholder: locale === 'zh-cn' ? '输入 OpenAI Access Token (JWT)' : 'Enter OpenAI Access Token (JWT)',
                helpUrl: 'https://chatgpt.com/'
            }
        },
        // 智谱 AI
        {
            id: 'zhipu',
            name: locale === 'zh-cn' ? '智谱 AI' : 'Zhipu AI',
            icon: 'zap',
            auth: {
                required: true,
                loggedIn: false,
                type: 'key',
                placeholder: locale === 'zh-cn' ? '输入智谱 AI Key' : 'Enter Zhipu AI Key',
                helpUrl: 'https://open.bigmodel.cn/usercenter/apikeys'
            }
        },
        // Z.ai
        {
            id: 'zai',
            name: 'Z.ai',
            icon: 'beaker',
            auth: {
                required: true,
                loggedIn: false,
                type: 'key',
                placeholder: locale === 'zh-cn' ? '输入 Z.ai Key' : 'Enter Z.ai Key',
                helpUrl: 'https://zai.sh/'
            }
        },
        // Google Antigravity
        {
            id: 'google',
            name: 'Google Antigravity',
            icon: 'globe',
            auth: {
                required: true,
                loggedIn: false,
                type: 'oauth',
                placeholder: locale === 'zh-cn' ? '通过 OAuth 登录' : 'Login via OAuth',
                helpUrl: 'https://github.com/NoeFabris/opencode-antigravity-auth'
            }
        }
    ];
}

export function getProviderDefinition(id: ProviderId): Omit<Provider, 'accounts'> | undefined {
    return getProviderDefinitions().find(p => p.id === id);
}
