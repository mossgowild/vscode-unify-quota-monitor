import * as vscode from 'vscode';
import { AuthManager } from './managers/AuthManager';
import { UsageManager } from './managers/UsageManager';
import { UsageViewProvider } from './ui/UsageViewProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('Unify Quota Monitor is now active!');

    const authManager = new AuthManager();
    const usageManager = new UsageManager(authManager);
    const viewProvider = new UsageViewProvider(context.extensionUri, usageManager);

    authManager.setUsageManager(usageManager);

    usageManager.startAutoRefresh();

    usageManager.refresh();

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('unifyQuota.usageView', viewProvider),
        vscode.commands.registerCommand('unifyQuota.manageAccounts', async () => {
            await authManager.showAccountMenu();
        }),
        vscode.commands.registerCommand('unifyQuota.refresh', async () => {
            await usageManager.refresh();
        }),
        {
            dispose: () => usageManager.stopAutoRefresh()
        }
    );
}

export function deactivate() {
    console.log('Unify Quota Monitor is deactivated.');
}
