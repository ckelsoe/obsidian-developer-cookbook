# Curated icon picker

A single-select row of icon buttons built from a developer-supplied list. Inline,
no modal, no search. Use it when a setting should offer a short, deliberate set of
icons (a marker style, a ribbon icon) rather than the entire icon set. For the
full browse-all set, use the `icon-picker` component instead.

## Files to copy

- `icon-choice.ts`
- `icon-choice.css` (paste into your plugin's `styles.css`)

## Dependencies

The `obsidian` package only (just `setIcon`). No `App`, no modal, no plugin types.

## API

```ts
const el = createIconChoice(parent, options);
```

Renders a single-select row of icon buttons into `parent` and returns the wrapper
`HTMLDivElement` so you can position or further style it. Selection is single: the
active button is highlighted, and re-selecting is a lookup, not a re-render.

### `IconChoiceOptions`

| Option | Type | Default | Description |
|---|---|---|---|
| `icons` | `string[]` | required | The icon ids to offer. Any id valid for `setIcon` (Lucide / Obsidian icons, plus anything registered via `addIcon`). |
| `current` | `string` | none | The currently selected id, if any. Its button starts active. |
| `onChange` | `(next: string \| undefined) => void \| Promise<void>` | required | Called with the picked id, or `undefined` when the user clears the selection (only reachable when `allowClear` is true). Persistence is your job: save inside this callback. |
| `allowClear` | `boolean` | `false` | Show a "Clear" button that deselects. Off by default, since most settings want a value always chosen. |

```ts
createIconChoice(containerEl, {
  icons: ["pencil", "highlighter", "message-square", "bookmark"],
  current: this.settings.markerIcon,
  allowClear: true,
  onChange: async id => {
    this.settings.markerIcon = id;          // id is undefined if cleared
    await this.plugin.saveData(this.settings);
  },
});
```

## Styling

Classes are namespaced `dcb-`. The active button uses `currentColor`, which the
icon SVG inherits, so the accent color recolors both the chip and the glyph. Paste
`icon-choice.css` into your `styles.css`.
