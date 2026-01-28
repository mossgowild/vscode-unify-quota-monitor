# 统一配额监控 (Unify Quota Monitor)

> 一个简洁美观的 VS Code 扩展，实时监控多个 AI Provider 的配额使用情况

![Preview](images/image.png)

## ✨ 为什么使用统一配额监控？

在使用多个 AI 服务时，频繁切换各平台查看配额很麻烦。这个扩展将所有用量信息集中在一个侧边栏面板中，让您一目了然地掌握所有账号的配额使用情况。

---

## 🚀 快速开始

### 安装

在 VS Code 扩展商店搜索 **"Unify Quota Monitor"** 并点击安装

### 添加第一个账号

1. 点击侧边栏的 **配额** 图标
2. 点击右上角的 **$(plus)** 按钮
3. 选择要添加的 Provider
4. 根据提示完成认证

就这么简单！现在您可以实时查看配额使用情况了。

---

## 📦 支持的 Provider

| Provider | 支持的配额类型 | 认证方式 |
|----------|---------------|----------|
| **OpenAI** | Token 使用量、重置倒计时 | Access Token (JWT) |
| **智谱 AI** | Token 限额、MCP 配额 | API Key |
| **Z.ai** | Token 限额、MCP 配额 | API Key |
| **Google Antigravity** | Token 使用量、重置倒计时 | Google OAuth |
| **Gemini CLI** | 使用百分比、重置倒计时 | Google OAuth |

---

## 🎯 核心功能

### 📊 实时用量监控
- 在侧边栏实时显示所有 Provider 的配额使用情况
- 清晰的进度条和百分比显示
- 自动重置倒计时（如 "4h25m" 后重置）

### 👥 多账号管理
- 每个 Provider 可添加多个账号
- 支持为账号设置别名（如 "Work"、"Personal"）
- 单账号时不显示标签，多账号时清晰展示

### 🔄 自动刷新
- 默认每 60 秒自动刷新用量数据
- 首次加载自动显示，无需手动操作
- 可在设置中自定义刷新间隔或关闭自动刷新

### 🌍 国际化支持
- 支持中英文界面
- 自动跟随 VS Code 的语言设置

---

## 📖 使用指南

### 添加账号

1. 点击侧边栏的 **配额** 图标
2. 点击右上角的 **$(plus)** 按钮
3. 选择 Provider：
   - **OpenAI**: 输入 Access Token (JWT) 或通过 OAuth 登录
   - **智谱 AI / Z.ai**: 输入 API Key
   - **Google Antigravity / Gemini CLI**: 通过浏览器进行 OAuth 认证
4. （可选）为账号设置别名

### 管理账号

1. 点击右上角的 **$(plus)** 按钮
2. 在已登录账号列表中点击要管理的账号
3. 选择操作：
   - **设置别名**: 修改账号显示名称
   - **重新登录**: 更新认证凭证
   - **退出登录**: 删除该账号

### 刷新用量

点击右上角的 **$(refresh)** 按钮手动刷新所有账号的用量数据

---

## ⚙️ 配置选项

在 VS Code 设置中搜索 `unifyQuotaMonitor`：

### 自动刷新配置

```json
{
  "unifyQuotaMonitor.autoRefresh": {
    "enabled": true,
    "intervalMs": 60000
  }
}
```

- `enabled`: 是否启用自动刷新（默认: `true`）
- `intervalMs`: 刷新间隔，单位为毫秒（默认: `60000` = 1 分钟）

---

## ❓ 常见问题

**Q: 如何区分多个账号？**  
A: 为每个账号设置别名（如 "Work"、"Personal"），方便识别。

**Q: 自动刷新会影响性能吗？**  
A: 不会。默认每分钟刷新一次，非常轻量，可根据需要在设置中调整间隔。

**Q: 数据存储在哪里？**  
A: 所有账号数据都存储在 VS Code 的全局设置中，安全可靠。

**Q: Panel 中什么时候显示账号标签？**  
A: 当 Provider 只有一个账号时不显示账号标签，有多个账号时显示别名或 ID。

---

## 🎨 界面说明

### 侧边栏面板
- **Provider 区域**: 显示每个 Provider 的名称
- **账号区域**:
  - **单账号**: 不显示账号标签，直接显示用量
  - **多账号**: 显示每个账号的别名或 ID，以及对应的用量详情
- **用量信息**:
  - 进度条: 可视化显示使用百分比
  - 用量数值: 显示具体使用量（Token 单位为 M）
  - 重置倒计时: 显示距离重置的剩余时间（如 "4h25m"）

### 工具栏按钮
- **$(plus) 添加账号**: 打开账号管理菜单
- **$(refresh) 刷新**: 手动刷新所有账号的用量数据（刷新时显示进度条）

---

## 🔧 开发者信息

### 从源码安装

```bash
git clone https://github.com/mossgowild/vscode-unify-quota-monitor.git
cd vscode-unify-quota-monitor
npm install
npm run build
code .
```

### 可用命令

- `unifyQuotaMonitor.manageAccounts`: 打开账号管理菜单
- `unifyQuotaMonitor.refresh`: 刷新用量数据

### 配置项说明

**unifyQuotaMonitor.accounts** (由扩展自动管理，无需手动编辑)
```json
[
  {
    "id": "openai-xxx...",
    "providerId": "openai",
    "alias": "Work",
    "credential": "sk-xxx..."
  }
]
```

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

[MIT](LICENSE)

---

## 📝 更新日志

### Unreleased
- ✨ 新增 Gemini CLI 支持
- 🎯 支持 Gemini 3/2.5/2.0/1.5 系列模型
- 🔐 Gemini CLI 的 Google OAuth 认证

### 0.0.1 (2025-01-23)
- ✨ 初始版本发布
- 🎯 支持 OpenAI、智谱 AI、Z.ai、Google Antigravity
- 👥 多账号支持
- 🏷️ 账号别名功能
- 🔄 自动刷新功能
- 🌍 国际化支持（中英文）

---

## 🌏 [English](README.md)
