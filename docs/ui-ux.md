# UI/UX 设计规范

## 设计参考

UI 样式参考 GitHub Copilot Status Bar 的设计规范，确保视觉一致性。

## 样式规范

### 进度条样式

- **高度**: `4px`
- **圆角**: `4px`
- **边框**: `1px solid var(--vscode-gauge-border)`
- **背景色**: `var(--vscode-gauge-background)` (30% 透明度)
- **填充色**:
  - 正常: `var(--vscode-gauge-foreground)`
  - 警告 (≥75%): `var(--vscode-gauge-warningForeground)`
  - 错误 (≥90%): `var(--vscode-gauge-errorForeground)`
- **上下边距**: `2px 0`

### 文字样式

- **Provider 标题**: 字重 `600`，颜色 `var(--vscode-descriptionForeground)`，下边距 `0.8em`
- **用量数值**: 字体大小 `0.85em`，颜色 `var(--vscode-descriptionForeground)`，透明度 `0.8`
- **Reset 时间**: 字体大小 `0.85em`，颜色 `var(--vscode-descriptionForeground)`，透明度 `0.8`，居左对齐

### 布局与间距

- **Content 内边距**: `0.5em 1em` (上下 0.5em，左右 1em)
- **Provider Section**: 上下外边距 `0.6em`，下内边距 `0.8em`，底部分割线 `1px solid var(--vscode-panel-border)`
- **Account Block**: 上外边距 `1.2em`，下外边距 `0.6em` (紧跟 Provider Header 时为 `0.8em`)
- **Usage Grid**: 列宽 `minmax(12em, 1fr)` (使用相对单位)，行间距 `0.2em`，列间距 `1em`
- **Usage Item**: 无内边距 (`padding: 0`)

### 容器样式

- 移除账号块的背景色和边框，使用透明背景（与 Copilot 一致）
- 无额外圆角和装饰，保持简洁风格

### 响应式设计

- 使用相对单位 (`em`, `%`) 而非绝对像素 (`px`)，确保在不同字体大小下的一致性
- Grid 布局自动适应容器宽度

### 主题适配

所有颜色使用 VS Code 主题变量，自动适配深色/浅色/高对比度主题。

## 数据处理与展示

### Reset Time 显示规则

- 剩余时间 > 1 小时：仅显示时分 (e.g. `2h 30m`)
- 剩余时间 < 1 小时：显示分秒 (e.g. `59m 30s`)
- 前端定时器 (`setInterval`) 每秒实时更新倒计时

### 排序规则

- **Provider 排序**: 面板中的 Provider 显示顺序严格遵循 `unifyQuotaMonitor.providers` 配置中的顺序。
- **配额排序**: 按照使用百分比 (Used / Total) **升序**排列，即剩余配额越多越靠前。
- Z.ai/Zhipu: Token Limit 类型的配额始终排在 Request Limit 之前，组内再按使用百分比升序排列。
- Request 类型的配额：不显示单位后缀 ("requests")

## UI 交互

### 侧边栏 Panel

- 使用 Webview View，由 `use-view.ts` 管理
- **无闪烁刷新**: 数据刷新时旧数据保留，直到新数据就绪

### 账号管理 QuickPick

- **Label**: 显示 Provider 名称 (e.g., "Google Antigravity")
- **Description**: 显示账号 Alias 或 ID

### 认证与存储

- 数据持久化在 `unifyQuotaMonitor.accounts` 全局配置中
- `ProviderDefinition` 不再包含 `icon` 和 `helpUrl` (已移除未使用的字段)
- **UI 错误提示**: `Account` 支持 `error` 字段，当 API 调用失败时（如 Token 失效或网络错误），在 UI 上直接显示红色错误详情

## 设计原则

- **简洁**: 移除不必要的装饰和背景
- **主题感知**: 使用 VS Code 主题变量，自动适配
- **响应式**: 使用相对单位，确保不同字体大小下的一致性
- **与 Copilot 一致**: 参考 GitHub Copilot Status Bar 的设计规范

### 相关文档

- [架构设计](./architecture.md) - MVC 架构和数据流
- [认证机制](./authentication.md) - OAuth 流程
- [设计历史](./design-history.md) - 样式演进记录
