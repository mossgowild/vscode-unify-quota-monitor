# UI/UX Design Guidelines

## Design Reference

UI styles follow GitHub Copilot Status Bar design specifications to ensure visual consistency.

## Style Guidelines

### Progress Bar Styles

- **Height**: `4px`
- **Border Radius**: `4px`
- **Border**: `1px solid var(--vscode-gauge-border)`
- **Background Color**: `var(--vscode-gauge-background)` (30% opacity)
- **Fill Colors**:
  - Normal: `var(--vscode-gauge-foreground)`
  - Warning (≥75%): `var(--vscode-gauge-warningForeground)`
  - Error (≥90%): `var(--vscode-gauge-errorForeground)`
- **Vertical Margins**: `2px 0`

### Text Styles

- **Provider Title**: Font weight `600`, color `var(--vscode-descriptionForeground)`, bottom margin `0.8em`
- **Usage Values**: Font size `0.85em`, color `var(--vscode-descriptionForeground)`, opacity `0.8`
- **Reset Time**: Font size `0.85em`, color `var(--vscode-descriptionForeground)`, opacity `0.8`, left-aligned

### Layout & Spacing

- **Content Padding**: `0.5em 1em` (top/bottom 0.5em, left/right 1em)
- **Provider Section**: Top/bottom margin `0.6em`, bottom padding `0.8em`, bottom border `1px solid var(--vscode-panel-border)`
- **Account Block**: Top margin `1.2em`, bottom margin `0.6em` (when following Provider Header: `0.8em`)
- **Usage Grid**: Column width `minmax(12em, 1fr)` (using relative units), row gap `0.2em`, column gap `1em`
- **Usage Item**: No padding (`padding: 0`)

### Container Styles

- Remove background color and border from account blocks, use transparent background (consistent with Copilot)
- No extra border radius or decorations, keep it clean and simple

### Responsive Design

- Use relative units (`em`, `%`) instead of absolute pixels (`px`) to ensure consistency across different font sizes
- Grid layout automatically adapts to container width

### Theme Adaptation

All colors use VS Code theme variables, automatically adapting to dark/light/high contrast themes.

## Data Processing & Display

### Reset Time Display Rules

- Remaining time > 1 hour: Show hours and minutes only (e.g. `2h 30m`)
- Remaining time < 1 hour: Show minutes and seconds (e.g. `59m 30s`)
- Frontend timer (`setInterval`) updates countdown every second

### Sorting Rules

- **Provider Ordering**: Provider display order in the panel strictly follows the order defined in `unifyQuotaMonitor.providers` configuration.
- **Quota Sorting**: Sorted by usage percentage (Used / Total) in **ascending** order, meaning more remaining quota appears first.
- Z.ai/Zhipu: Token Limit type quotas always appear before Request Limit, then sorted by usage percentage in ascending order within each group.
- Request type quotas: Do not display unit suffix ("requests")

## UI Interactions

### Sidebar Panel

- Uses Webview View, managed by `use-view.ts`
- **Flicker-free Refresh**: Old data is retained during refresh until new data is ready

### Account Management QuickPick

- **Label**: Display Provider name (e.g., "Google Antigravity")
- **Description**: Display account name or ID

### Authentication & Storage

- Data is persisted in `unifyQuotaMonitor.accounts` global configuration
- `ProviderDefinition` no longer contains `icon` and `helpUrl` (removed unused fields)
- **UI Error Messages**: `Account` supports `error` field, when API calls fail (e.g., Token expiration or network errors), red error details are displayed directly in the UI

## Design Principles

- **Clean**: Remove unnecessary decorations and backgrounds
- **Theme-aware**: Use VS Code theme variables for automatic adaptation
- **Responsive**: Use relative units to ensure consistency across different font sizes
- **Consistent with Copilot**: Follow GitHub Copilot Status Bar design specifications

### Related Documentation

- [Architecture Design](./architecture.md) - MVC architecture and data flow
- [Authentication Mechanism](./authentication.md) - OAuth flow
- [Design History](./design-history.md) - Style evolution records
