# Browse-all icon picker

A searchable, virtualized grid over every registered icon (the full Lucide /
Obsidian set plus any `addIcon` registrations). The grid is windowed, so the whole
~1500-icon set scrolls smoothly without a render cap. Use it when the user should
be free to pick any icon. For a short curated set, use `icon-choice` instead.

## Files to copy

Copy all four `.ts` files in this folder (the picker is split into pure, testable
pieces):

- `icon-picker.ts` — the inline trigger and the modal
- `virtual-list.ts` — fixed-height virtual list (DOM wiring)
- `virtual-window.ts` — pure windowing math (no DOM)
- `icon-collect.ts` — pure filter and sort

Plus `icon-picker.css` (paste into your plugin's `styles.css`).

## Dependencies

The `obsidian` package, plus the three sibling files above. No plugin instance or
domain types.

## `createIconPicker` (inline control)

```ts
const el = createIconPicker(parent, options);
```

Renders a square trigger showing the current icon (its id in the tooltip and
aria-label), plus a "Clear" button once an icon is set. Clicking the trigger opens
the browse-all modal. Returns the wrapper `HTMLDivElement`.

### `IconPickerOptions`

| Option | Type | Default | Description |
|---|---|---|---|
| `app` | `App` | required | Your plugin's `this.app`. Needed to open the modal. |
| `current` | `string` | none | The currently chosen icon id. |
| `onChange` | `(next: string \| undefined) => void \| Promise<void>` | required | Called with the chosen id, or `undefined` when the user clears it. Save inside this callback. |

```ts
createIconPicker(containerEl, {
  app: this.app,
  current: this.settings.ribbonIcon,
  onChange: async id => {
    this.settings.ribbonIcon = id;          // undefined if cleared
    await this.plugin.saveData(this.settings);
  },
});
```

## `SelectIconModal` (the modal directly)

If you do not want the inline trigger (for example, opening the picker straight
from a command), open the modal yourself:

```ts
new SelectIconModal(app, current, id => { /* use id */ }).open();
```

Constructor: `new SelectIconModal(app: App, current: string, onChoose: (id: string) => void)`.
Pass `""` for `current` when nothing is selected. `onChoose` fires with the chosen
id and the modal closes.

## Styling

Classes are namespaced `dcb-` (`dcb-icon-*` for the picker, `dcb-vlist-*` for the
virtual list). Paste `icon-picker.css` into your `styles.css`.

Note: `virtual-list.ts` sets a few `.style` values (the scroll-spacer height and
the row translate offset). That is dynamic, per-scroll geometry that cannot live in
a stylesheet, not static styling, so it does not violate the developer-portal
`no-static-styles` rule.
