# Form modal

The general-case modal, in three layers you copy independently:

1. **`FormModal`** (`form-modal.ts`) — the shell. You supply the body via a
   `render` callback; it owns the title, scrollable body, footer buttons, focus,
   dismissal, and a resolved Promise.
2. **`openSchemaForm`** (`schema-form.ts`) — a declarative layer on top of the
   shell. Describe fields as data; it renders them with native Obsidian `Setting`
   controls, validates, and returns the values.
3. **`serializeCodeBlock`** (`code-block.ts`) — turn a values object into a fenced
   `key:value` code block.

Targets Obsidian **1.13+**.

## Files to copy

- Shell only: `form-modal.ts` + `form-modal.css`.
- Declarative forms: also add `schema-form.ts`.
- Building a code block from a form: also add `code-block.ts`.

Paste `form-modal.css` into your plugin's `styles.css`.

## Dependencies

The `obsidian` package. `schema-form.ts` also imports `FormModal` from this folder.
`code-block.ts` has no dependencies.

---

## Layer 1: `FormModal`

```ts
const submitted = await new FormModal(app, options).ask();
```

`ask()` returns `Promise<boolean>`: `true` if the user submitted, `false` if they
cancelled or dismissed. Capture your field values in closure variables inside
`render`, and read them in `onSubmit` (or after `ask()` resolves).

### `FormModalOptions`

| Option | Type | Default | Description |
|---|---|---|---|
| `title` | `string` | required | Modal title. |
| `cta` | `string` | `"Save"` | Primary button label. |
| `destructive` | `boolean` | `false` | Render the primary button red. |
| `submitDisabled` | `boolean` | `false` | Start with the primary button disabled until your validation enables it. |
| `render` | `(body: HTMLElement, form: FormControls) => void` | required | Build the body. `body` is a scrollable content div you populate. |
| `onSubmit` | `() => boolean \| void \| Promise<boolean \| void>` | required | Runs on submit. Return `false` to keep the modal open (validation failed); return `true` or nothing to accept and close. May be async; the button is disabled while it runs and the modal stays open on a thrown error. |

### `FormControls` (passed to `render`)

| Member | Type | Description |
|---|---|---|
| `setSubmitEnabled` | `(enabled: boolean) => void` | Enable/disable the primary button. Call as fields change to gate submission. |
| `submit` | `() => void` | Trigger submit programmatically (for example an Enter handler). |
| `cancel` | `() => void` | Close as a cancel (`ask()` resolves `false`). |

```ts
let name = "";
const ok = await new FormModal(this.app, {
  title: "Add bookmark",
  cta: "Add",
  submitDisabled: true,
  render: (body, form) => {
    const input = body.createEl("input", { attr: { type: "text" } });
    input.addEventListener("input", () => {
      name = input.value;
      form.setSubmitEnabled(name.trim() !== "");
    });
  },
  onSubmit: async () => { await this.save(name); },
}).ask();
```

---

## Layer 2: `openSchemaForm`

```ts
const result = await openSchemaForm(app, options);   // SchemaFormResult | null
```

Describe a form as a list of field definitions (which maps directly from YAML or
JSON). It renders each field with the matching native `Setting` control, validates,
and resolves a result, or `null` if the user cancelled.

### `SchemaFormOptions`

| Option | Type | Default | Description |
|---|---|---|---|
| `title` | `string` | required | Modal title. |
| `cta` | `string` | `"Save"` | Primary button label. |
| `destructive` | `boolean` | `false` | Render the primary button red. |
| `fields` | `SchemaField[]` | required | The field definitions (see below). |
| `initialValues` | `Record<string, unknown>` | none | Seed the form with existing values, keyed by field key, overriding each field's `default`. This is what turns the form into an editor: parse an existing block into a values map, pass it here, and the form opens pre-filled. |
| `preview` | `(values: Record<string, unknown>, previewEl: HTMLElement) => void` | none | A live preview pane at the bottom of the modal. Called on open and after every field change with the current effective values. Render anything into `previewEl` (a generated code block, a rendered diagram, a summary). The pane is cleared before each call. |

### `SchemaField`

`type` is one of: `"string"` (alias for `"text"`), `"text"`, `"textarea"`,
`"number"`, `"toggle"`, `"dropdown"`, `"slider"`, `"color"`.

| Field property | Type | Applies to | Description |
|---|---|---|---|
| `key` | `string` | all | Output property name (and code-block key for the serializer). Required. |
| `type` | `FieldType` | all | The control to render. Required. |
| `name` | `string` | all | Display label. Defaults to `key`. |
| `description` | `string` | all | Short helper text under the label. |
| `explanation` | `string` | all | Longer help for first-time users, rendered full-width below the row. |
| `mandatory` | `boolean` | all | The user must provide a value; the field cannot be empty or skipped. Non-mandatory fields get a "skip" toggle (use the global setting / leave out). |
| `default` | `string \| number \| boolean` | all | Initial value (overridden by `initialValues`). |
| `pattern` | `string` | text/string/textarea | Regex (as a string, so it survives YAML/JSON) validating the value. Checked when non-empty, or always if `mandatory`. |
| `validate` | `(value: string) => string \| null` | text/string/textarea | Programmatic validator for what a regex cannot express. Return an error string to block, or `null` to allow. |
| `placeholder` | `string` | text/string/textarea | Input placeholder. |
| `options` | `Array<string \| { value: string; label: string }>` | dropdown | The choices: bare values, or explicit value/label pairs. |
| `integer` | `boolean` | number | Require a whole number. |
| `min` / `max` | `number` | number/slider | Bounds. For slider, the track range. |
| `step` | `number` | slider | Slider step (default 1). |

### `SchemaFormResult`

| Member | Type | Description |
|---|---|---|
| `values` | `Record<string, unknown>` | Convenience map of fields that were set and not skipped (skipped and empty fields omitted). This is what you usually use. |
| `fields` | `Record<string, FieldResult>` | Per-field outcome. Each `FieldResult` is `{ valid: boolean; skipped: boolean; result: unknown }`. |

### The skip mechanism

Any non-mandatory field shows a "skip" toggle. When the user skips it, the field is
disabled, excluded from validation, reported as `skipped: true`, and left out of
`values`. This is for partial-override use cases (a code block that only sets the
keys the user cares about, the rest falling back to a global default).

```ts
const res = await openSchemaForm(this.app, {
  title: "Insert molecule",
  cta: "Insert",
  fields: [
    { key: "smiles", name: "SMILES", type: "string", mandatory: true, pattern: "^[A-Za-z0-9@+\\-\\[\\]()=#$%./\\\\]+$" },
    { key: "theme", name: "Theme", type: "dropdown", options: ["light", "dark", "oldschool"] },
    { key: "background", name: "Background", type: "color" },     // skippable
    { key: "height", name: "Height", type: "number", integer: true, min: 1, default: 150 },
  ],
  preview: (values, el) => el.createEl("pre", { text: JSON.stringify(values, null, 2) }),
});
if (res) {
  // res.values.smiles, res.values.theme, ...
}
```

---

## Layer 3: `serializeCodeBlock`

```ts
const block = serializeCodeBlock(options);   // string
```

Builds a fenced code block of the shape "optional first positional line, then
`key:value` lines." The inverse of the common "read line 0 as a primary value, the
rest as key:value overrides" code-block processor. Does not insert it; the caller
decides where it goes (typically `editor.replaceSelection`).

### `CodeBlockOptions`

| Option | Type | Default | Description |
|---|---|---|---|
| `identifier` | `string` | required | The fence info string / language id (for example `"smiles"`). |
| `primary` | `unknown` | none | Optional first positional line, before the key:value lines. |
| `fields` | `Array<{ key: string; value: unknown }>` | required | Ordered key/value pairs. |
| `skipEmpty` | `boolean` | `true` | Skip `null` / `undefined` / `""` values, so optional fields stay out of the block and the consumer uses its default. |

```ts
const block = serializeCodeBlock({
  identifier: "smiles",
  primary: res.values.smiles,
  fields: ["theme", "background", "height"].map(k => ({ key: k, value: res.values[k] })),
});
editor.replaceSelection(block + "\n");
// ```smiles
// CN1C=NC2=...
// theme:oldschool
// height:150
// ```
```

## Choosing a layer

- Body is a known set of standard fields → `openSchemaForm`.
- Body is free-form or needs custom controls / a live render → `FormModal` render
  callback.
- You are turning a form result into a code block → add `serializeCodeBlock`.

## Styling

Classes are namespaced `dcb-` (`dcb-form*`, `dcb-field-*`). Paste `form-modal.css`
into your `styles.css`.
