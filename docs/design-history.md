# 设计历史

本文档记录 UI/UX 设计的演进过程和重要变更。

---

## 2026-01-24: GitHub Copilot Status Bar UI 对齐

### 目标
参考 GitHub Copilot Chat 项目的 Status Bar Item UI，统一样式风格。

### 主要变更

#### 1. 进度条样式升级
- 圆角从 `2px` 统一为 `4px`
- 新增 `1px solid var(--vscode-gauge-border)` 边框
- 背景色从 `var(--vscode-scrollbarSlider-background)` 改为 `var(--vscode-gauge-background)`
- 填充色从 `charts-*` 变量改为 `gauge-*` 变量 (foreground/warningForeground/errorForeground)

#### 2. 文字与布局优化
- Provider Header 颜色改为 `var(--vscode-descriptionForeground)`，下边距 `0.8em`
- 移除 Account Block 背景色和边框，采用透明设计
- Provider Section 使用相对单位 `em` (如 `12em` 列宽) 提升响应式表现
- Usage Grid 间距从 `0.6em` 增加到 `1em`

#### 3. 间距精细化
- Content 上下内边距 `0.5em`
- Provider Section 上外边距 `8px`，下外边距 `8px`，下内边距 `6px`
- Account Block 上外边距 `1.2em`（紧跟 Header 时 `0.8em`），下外边距 `0.6em`
- 进度条上下边距 `2px`

### 设计原则
- **简洁**: 移除不必要的装饰
- **主题感知**: 使用 VS Code 主题变量
- **响应式**: 使用相对单位
- **与 Copilot 一致**: 统一视觉风格

---

## 2026-01-24 (后续): 间距优化

### 目标
进一步优化间距，使用相对单位提升一致性。

### 主要变更

#### 1. Provider Section 间距调整
- 上下外边距从 `8px` 改为 `0.6em`（统一使用相对单位）
- 下内边距从 `6px` 改为 `0.8em`（更协调的间距比例）

#### 2. Usage Grid 间距精细化
- 从单一间距 `1em` 改为双值间距 `0.2em 1em`
- 行间距 `0.2em` 使垂直方向更紧凑
- 列间距 `1em` 保持水平方向的清晰分隔

### 优化效果
- 提升响应式表现
- 间距在不同字体大小下保持一致比例
- 视觉层次更加清晰

---

## 相关文档

- [UI/UX 设计规范](./ui-ux.md) - 当前完整样式规范
- [架构设计](./architecture.md) - 架构和代码规则
