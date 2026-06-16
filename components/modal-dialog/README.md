# Modal dialogs

Two small, Promise-based modals for the common cases: a yes/no confirmation and a
single-line text prompt. You `await` the answer instead of threading callbacks.

## Files to copy

- `modal-dialog.ts`
- `modal-dialog.css` (paste into your plugin's `styles.css`)

## Dependencies

The `obsidian` package only. No plugin instance or domain types.

## `ConfirmModal`

```ts
const ok = await new ConfirmModal(app, options).ask();
```

`ask()` returns `Promise<boolean>`: `true` if the user confirmed, `false` for every
other exit (Cancel, Escape, click-out). It resolves exactly once, so an awaiting
caller never hangs on a dismissed dialog.

### `ConfirmModalOptions`

| Option | Type | Default | Description |
|---|---|---|---|
| `title` | `string` | required | Heading text. |
| `message` | `string` | required | The main prompt line. |
| `detail` | `string` | none | Optional second line in muted text. Use it for a "this cannot be undone" caveat so the message stays short. |
| `cta` | `string` | `"Confirm"` | Primary button label. Keep it sentence case. |
| `destructive` | `boolean` | `false` | Render the primary button red, for deletes and irreversible actions. |

```ts
const ok = await new ConfirmModal(this.app, {
  title: "Delete note",
  message: "Remove this note from the vault?",
  detail: "You can undo with Ctrl/Cmd+Z if the file is open.",
  cta: "Delete",
  destructive: true,
}).ask();
if (ok) await this.doDelete();
```

## `PromptModal`

```ts
const value = await new PromptModal(app, options).ask();
```

`ask()` returns `Promise<string | null>`: the entered string, or `null` if the user
cancelled or dismissed. While `validate` returns an error the submit button is
disabled and the error shows beneath the input. Enter submits.

### `PromptModalOptions`

| Option | Type | Default | Description |
|---|---|---|---|
| `title` | `string` | required | Heading text. |
| `label` | `string` | none | Field label above the input. |
| `placeholder` | `string` | none | Input placeholder. |
| `initialValue` | `string` | `""` | Pre-filled value. |
| `cta` | `string` | `"Submit"` | Submit button label. |
| `validate` | `(value: string) => string \| null` | none | Return an error string to block submission (shown inline) or `null` to allow. Runs on every keystroke and on submit. Omit to accept any value, including empty. |

```ts
const name = await new PromptModal(this.app, {
  title: "Rename feed",
  label: "New name",
  initialValue: current,
  validate: v => (v.trim() === "" ? "Name cannot be empty." : null),
}).ask();
if (name !== null) await this.rename(name);
```

## Styling

All classes are namespaced `dcb-`. The component never injects styles at runtime;
paste `modal-dialog.css` into your `styles.css`. Rename the prefix only if you want
the classes to match your plugin's own; it is not required.

## Notes

- These are fixed-body modals. For an arbitrary body (multiple fields, custom
  controls, a live preview), use the `form-modal` component instead. `ConfirmModal`
  and `PromptModal` are effectively `FormModal` with the body pre-filled.
