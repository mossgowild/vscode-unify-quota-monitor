# UI/UX

## Design Principles

- **Clean**: No unnecessary decorations
- **Theme-aware**: VS Code theme variables
- **Responsive**: Relative units (`em`, `%`)
- **Consistent with Copilot**: GitHub Copilot Status Bar style

## Progress Bar

```css
height: 4px;
border-radius: 4px;
border: 1px solid var(--vscode-gauge-border);
background: var(--vscode-gauge-background);

/* Fill colors */
--vscode-gauge-foreground          /* Normal */
--vscode-gauge-warningForeground   /* ≥75% */
--vscode-gauge-errorForeground     /* ≥90% */
```

## Layout

| Element | Spacing |
|---------|---------|
| Content padding | `0.5em 1em` |
| Provider section margin | `0.6em 0` |
| Provider section padding | `0 0 0.8em 0` |
| Account block margin | `1.2em 0 0.6em` |
| Usage grid gap | `0.2em 1em` |

## Typography

| Element | Size | Weight | Color |
|---------|------|--------|-------|
| Provider title | inherit | 600 | `descriptionForeground` |
| Usage values | 0.85em | normal | `descriptionForeground` @ 0.8 opacity |
| Reset time | 0.85em | normal | `descriptionForeground` @ 0.8 opacity |

## Sorting

- **Provider order**: Config order (Object.keys order)
- **Usage items**: Usage % ascending (most remaining first)

## Reset Time Display

| Time Remaining | Format |
|----------------|--------|
| > 1 hour | `2h 30m` |
| < 1 hour | `59m 30s` |

Updated every second via `setInterval` in webview.

## Error Display

Account errors shown inline in red:

```html
<div class="account-error">${account.error}</div>
```
