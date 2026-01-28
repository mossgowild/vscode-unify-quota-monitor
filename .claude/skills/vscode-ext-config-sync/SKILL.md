# VS Code 扩展配置联动同步 Skill

## 描述

当修改 VS Code 扩展的配置相关内容时，确保所有关联文件保持同步。本 Skill 适用于任何涉及 `package.json`、`package.nls.*.json`、TypeScript 类型和实现文件的变更。

## 触发条件

当用户执行以下任一操作时激活：
- 添加/修改/删除 Provider 类型
- 变更配置项枚举值
- 修改命令 ID 或标题
- 变更视图 ID 或标题
- 修改配置项结构

## 文件依赖关系图

```
package.json (源头)
  ├── package.nls.json (英文本地化)
  ├── package.nls.zh-cn.json (中文本地化)
  └── src/
      ├── types.ts (TypeScript 类型)
      ├── providers.ts (Provider 定义)
      ├── composables/
      │   ├── use-usage.ts (数据获取逻辑)
      │   └── use-view.ts (视图交互逻辑 - 多处比较)
      └── utils/
          └── auth-helpers.ts (认证辅助 - 部分相关)

AGENTS.md (文档同步)
.claude/skills/vscode-ext-config-sync/SKILL.md (Skill 自身示例更新)
```

## 联动规则

### 1. Provider ID 变更

当修改 Provider ID（如 `google` → `google-antigravity`）时：

**必须更新的文件：**

| 文件 | 位置 | 说明 |
|------|------|------|
| `package.json` | `contributes.configuration.properties[].items.properties.providerId.enum` | 枚举值列表 |
| `package.json` | `contributes.configuration.properties[].items.properties.providerId.enumDescriptions` | 枚举描述 |
| `package.nls.json` | `configuration.accounts.providerId.markdownDescription` | Provider 列表说明 |
| `package.nls.zh-cn.json` | 同上 | 中文版本 |
| `src/types.ts` | `ProviderId` 类型定义 | `type ProviderId = '...'` |
| `src/providers.ts` | `getProviderDefinitions()` 中的 `id` 字段 | Provider 对象定义 |
| `src/composables/use-usage.ts` | 所有 `providerId === 'xxx'` 比较 | 第 26、478 行附近 |
| `src/composables/use-view.ts` | 所有 `providerId === 'xxx'` 比较 | 第 472、570 行附近 |
| `AGENTS.md` | Provider 表格 | 文档同步 |
| `SKILL.md` | 示例代码 | 更新示例中的 providerId |

**验证命令：**
```bash
npm run typecheck
```

### 2. 命令变更

当添加/修改/删除命令时：

**必须更新的文件：**

| 文件 | 位置 |
|------|------|
| `package.json` | `contributes.commands` 数组 |
| `package.json` | `contributes.menus` 中的引用 |
| `package.nls.json` | `command.{commandId}.title` |
| `package.nls.zh-cn.json` | 中文版本 |
| `src/extension.ts` | `useCommand` 注册 |

### 3. 视图变更

当添加/修改/删除视图时：

**必须更新的文件：**

| 文件 | 位置 |
|------|------|
| `package.json` | `contributes.viewsContainers` |
| `package.json` | `contributes.views` |
| `package.nls.json` | `viewsContainers.*.title` 和 `views.*.name` |
| `package.nls.zh-cn.json` | 中文版本 |
| `src/composables/use-view.ts` | `useWebviewView` 注册 |

### 4. 配置项变更

当添加/修改/删除配置项时：

**必须更新的文件：**

| 文件 | 位置 |
|------|------|
| `package.json` | `contributes.configuration.properties` |
| `package.nls.json` | `configuration.{property}.markdownDescription` |
| `package.nls.zh-cn.json` | 中文版本 |
| `src/composables/use-config.ts` | `defineConfig` 定义 |
| `src/types.ts` | 相关类型定义 |

## 变更检查清单

### Provider ID 变更检查清单

**第 1 步：搜索所有引用**
```bash
grep -rn "antigravity" src/ package.json package.nls*.json
```

**第 2 步：逐一更新**
- [ ] `package.json` 中的 enum 更新（两处：enum 和 enumDescriptions）
- [ ] `package.nls.json` 中 providerId 描述更新
- [ ] `package.nls.zh-cn.json` 中 providerId 描述更新
- [ ] `src/types.ts` 中 ProviderId 类型更新
- [ ] `src/providers.ts` 中 Provider 定义更新
- [ ] `src/composables/use-usage.ts` 中所有比较逻辑更新（搜索 `providerId === 'xxx'`）
- [ ] `src/composables/use-view.ts` 中所有比较逻辑更新（搜索 `providerId === 'xxx'` 和 `account.providerId === 'xxx'`）
- [ ] `AGENTS.md` 中 Provider 表格更新
- [ ] `SKILL.md` 中示例代码更新

**第 3 步：验证**
- [ ] 运行 `npm run typecheck` 验证

### 命令变更检查清单

- [ ] `package.json` commands 数组更新
- [ ] `package.json` menus 引用更新
- [ ] `package.nls.json` 命令标题更新
- [ ] `package.nls.zh-cn.json` 命令标题更新
- [ ] `src/extension.ts` 命令注册更新

### 视图变更检查清单

- [ ] `package.json` viewsContainers 更新
- [ ] `package.json` views 更新
- [ ] `package.nls.json` 视图标题更新
- [ ] `package.nls.zh-cn.json` 视图标题更新
- [ ] `src/composables/use-view.ts` 视图注册更新

## 常见陷阱（按发生频率排序）

1. **遗漏 use-view.ts 中的比较逻辑** ⚠️ 最常见
   - 该文件有两处需要修改：`providerId === 'xxx'` 和 `account.providerId === 'xxx'`
   - 分别在 `addAccount()` 和 `reloginAccount()` 函数中

2. **遗漏枚举同步** 
   - `package.json` 中的 `enum` 和 `enumDescriptions` 必须成对更新
   - 顺序不一致会导致显示错位

3. **遗漏文档同步**
   - `AGENTS.md` 中的 Provider 表格需要同步更新
   - `SKILL.md` 中的示例代码需要同步更新

4. **混淆不同概念**
   - `auth-helpers.ts` 中的 `'github'` 是 VS Code API 作用域，不是 providerId，**不应修改**
   - User-Agent 字符串中的标识（如 `antigravity/1.11.9`）是 API 要求的，**不应修改**

5. **本地化遗漏**
   - 只更新 `package.nls.json` 而忘记 `package.nls.zh-cn.json`
   - 忘记更新 `l10n/bundle.l10n.zh-cn.json` 中的相关翻译

## 快速搜索命令

### 变更前：确认所有引用位置
```bash
# 查找当前 Provider ID 的所有引用
grep -rn "'antigravity'" src/ package.json package.nls*.json

# 查找比较逻辑（重点检查 use-usage.ts 和 use-view.ts）
grep -rn "providerId ===" src/composables/
grep -rn "account.providerId ===" src/composables/

# 查找类型定义
grep -rn "type ProviderId" src/

# 查找枚举定义
grep -n "enum" package.json | head -20
```

### 变更后：验证是否遗漏
```bash
# 确认旧 ID 已完全替换
grep -rn "'antigravity'" src/ package.json || echo "清理完成"

# 确认新 ID 已正确添加
grep -rn "'google-antigravity'" src/ package.json

# 类型检查
npm run typecheck
```

## 实战示例：Provider ID 从 'google' 改为 'google-antigravity'

### 完整变更流程

#### 步骤 1: 搜索所有引用
```bash
grep -rn "'google'" src/ package.json package.nls*.json
```

#### 步骤 2: 更新 package.json（2 处）
```json
{
  "contributes": {
    "configuration": {
      "properties": {
        "unifyQuotaMonitor.accounts": {
          "items": {
            "properties": {
              "providerId": {
                "enum": [
                  "openai",
                  "google-antigravity",
                  "github-copilot",
                  "gemini-cli",
                  "zhipu",
                  "zai"
                ],
                "enumDescriptions": [
                  "OpenAI",
                  "Google Antigravity",
                  "GitHub Copilot",
                  "Gemini CLI",
                  "Zhipu AI",
                  "Z.ai"
                ]
              }
            }
          }
        }
      }
    }
  }
}
```

#### 步骤 3: 更新本地化文件
```json
// package.nls.json
{
  "configuration.accounts.providerId.markdownDescription": "Provider type: `openai` (OpenAI), `google-antigravity` (Google Antigravity), `github-copilot` (GitHub Copilot), `gemini-cli` (Gemini CLI), `zhipu` (Zhipu AI), `zai` (Z.ai)"
}

// package.nls.zh-cn.json
{
  "configuration.accounts.providerId.markdownDescription": "服务商类型：`openai`（OpenAI）、`google-antigravity`（Google Antigravity）、`github-copilot`（GitHub Copilot）、`gemini-cli`（Gemini CLI）、`zhipu`（智谱 AI）、`zai`（Z.ai）"
}
```

#### 步骤 4: 更新 TypeScript 类型
```typescript
// src/types.ts
export type ProviderId = 'openai' | 'zhipu' | 'zai' | 'google-antigravity' | 'github-copilot' | 'gemini-cli'
```

#### 步骤 5: 更新 Provider 定义
```typescript
// src/providers.ts
function getProviderDefinitions(): ProviderDefinition[] {
  return [
    // ... 其他 provider
    {
      id: 'google-antigravity',
      name: 'Google Antigravity',
      auth: {
        required: true,
        type: 'oauth',
        placeholder: t('Login with Antigravity OAuth'),
      },
    },
    // ... 其他 provider
  ]
}
```

#### 步骤 6: 更新业务逻辑（⚠️ 容易遗漏）

**src/composables/use-usage.ts**（2 处）：
```typescript
// 第 26 行附近
async function getAccessToken(account: StoredAccount): Promise<string | null> {
  if (account.providerId === 'google-antigravity') {
    // ...
  }
}

// 第 478 行附近
const promises = storedAccounts.map(async (account) => {
  if (providerId === 'openai') {
    return fetchOpenAIUsage(account)
  } else if (providerId === 'google-antigravity') {
    return fetchGoogleUsage(account)
  }
  // ...
})
```

**src/composables/use-view.ts**（2 处）：
```typescript
// 第 472 行附近 - addAccount 函数
async function addAccount(providerId: ProviderId) {
  if (providerId === 'google-antigravity') {
    credential = await loginWithGoogle()
  }
  // ...
}

// 第 570 行附近 - reloginAccount 函数
async function reloginAccount(accountId: string) {
  if (account.providerId === 'google-antigravity') {
    credential = await loginWithGoogle()
  }
  // ...
}
```

#### 步骤 7: 更新文档
```markdown
<!-- AGENTS.md -->
| `google-antigravity` | Google Antigravity | OAuth | refresh_token (端口 51121) |
```

```markdown
<!-- SKILL.md 中的示例 -->
更新本文档中的示例代码，将 'google' 改为 'google-antigravity'
```

#### 步骤 8: 验证
```bash
# 1. 确认旧 ID 已完全替换
grep -rn "'google'" src/ package.json | grep -v "google-"
# 应该只返回 auth-helpers.ts 中的 VS Code API 作用域（这是正确的）

# 2. 确认新 ID 存在
grep -rn "'google-antigravity'" src/ package.json

# 3. 类型检查
npm run typecheck
```
