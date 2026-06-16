# Color picker

Three ways to choose a color in one control: preset swatches (theme-adaptive by
default, or a custom palette), a type-in hex field, and a native operating-system
picker chip (its built-in wheel / spectrum). The native chip is a standard
`<input type="color">`, so it works on Windows, macOS, and Linux with no
platform-specific code.

## Files to copy

- `color-picker.ts`
- `color-picker.css` (paste into your plugin's `styles.css`)

## Dependencies

None. The component uses only DOM APIs and Obsidian's global `HTMLElement` helpers
(`createDiv` / `createEl`), so there is no import to satisfy.

## API

```ts
const el = createColorPicker(parent, options);
```

Renders the control into `parent` and returns the wrapper `HTMLDivElement`.

### `ColorPickerOptions`

| Option | Type | Default | Description |
|---|---|---|---|
| `current` | `string` | none | Current value: a theme var string (`"var(--color-red)"`), a literal hex (`"#e93147"`), or `undefined` for nothing chosen. |
| `onChange` | `(next: string \| undefined) => void \| Promise<void>` | required | Called with the chosen value: a `var(--...)` string for a theme swatch, a `"#rrggbb"` for the hex field or native picker, or `undefined` on reset. Save inside this callback. |
| `swatches` | `string[]` | the 8 Obsidian theme colors | Override the preset swatches. Each entry is any CSS color string: use `"var(--color-red)"` to stay theme-adaptive, or a literal `"#rrggbb"` for a fixed brand color. |
| `hexField` | `boolean` | `true` | Show the type-in hex field. Set `false` for a swatches + native-chip only control. |

### The value contract

This is the load-bearing decision when you consume the picker. A preset theme
swatch emits its `var(--...)` string, so the stored color stays theme-adaptive
(it re-resolves in light and dark mode). The hex field and the native chip emit a
literal `"#rrggbb"`. Reset emits `undefined`. So a stored value is "a string that
is either a `var()` or a hex." Apply it with `el.style.color = value` (the browser
resolves both forms) and persist it verbatim. If you need to compute on the color
(lighten it, check contrast), resolve the `var()` to hex first via
`getComputedStyle`.

```ts
createColorPicker(containerEl, {
  current: this.settings.markerColor,        // "var(--color-red)" or "#e93147"
  onChange: async v => {
    this.settings.markerColor = v;           // undefined if reset
    await this.plugin.saveData(this.settings);
  },
  // swatches: ["#111827", "#e93147", "#08b94e"],  // optional fixed palette
});
```

## Helper exports

Both are pure and exported for reuse and unit testing:

- `rgbStringToHex(rgb: string): string | undefined` — convert `"rgb(r, g, b)"` /
  `"rgba(...)"` (what `getComputedStyle` returns) to `"#rrggbb"`. Returns
  `undefined` for unparseable input (`"transparent"`, `""`).
- `normalizeHex(input: string): string | undefined` — normalize a user-typed hex
  to `"#rrggbb"` lowercase. Accepts an optional leading `#` and 3- or 6-digit forms
  (`"#abc"` becomes `"#aabbcc"`). Returns `undefined` for invalid input, so the
  field can flag it without emitting a bad value.

## Styling

Classes are namespaced `dcb-`. Swatch and chip background colors are set from the
script because they are the chosen values (dynamic content, not static styling).
Paste `color-picker.css` into your `styles.css`.

## Notes

- Invalid hex is flagged (red border) and not emitted, so a half-typed `#e9` never
  clobbers a good stored value. Emission happens only on a complete 3- or 6-digit
  hex.
- The three inputs stay in sync by setting the native input's value silently (which
  does not fire `input`), so user gestures call `onChange` but programmatic
  reflection never does.
- No alpha channel: the native `<input type="color">` does not support opacity.
