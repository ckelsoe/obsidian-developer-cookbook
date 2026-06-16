# Stacked row

A settings-row layout that puts the label and description **on top** and the
control area **full-width below**, instead of Obsidian's default of label-left /
control-right.

## The problem it solves

Obsidian's `Setting` widget lays out the title and description on the left and the
control on the right. That is fine for short controls (a toggle, a dropdown, a
single-line text field). It is bad for **long** controls (a textarea, a composite
row like a color picker next to an icon picker, any free-form form), especially in
a narrow right-sidebar panel where the right rail gets squeezed to a sliver.

The stacked row gives the control the full width of the panel by moving the
label and description above it.

When to reach for each:

- **Short control** (toggle, dropdown, single-line text): keep using
  `new Setting(container).setName(...).setDesc(...).addToggle(...)`.
- **Long control** (textarea, composite picker row, multi-field form): use a
  stacked row.

## The code

This is the whole helper. Replace `myplugin-` with your plugin's CSS prefix
(this is an example, not a drop-in component, so it adopts your conventions):

```ts
export interface StackedRowOpts {
	name: string;
	description?: string;
	cls?: string;
}

export interface StackedRow {
	row: HTMLDivElement;
	content: HTMLDivElement;
}

// Title and optional description on top, a full-width content area below for
// the control. Append your control DOM into the returned `content` div.
export function createStackedRow(parent: HTMLElement, opts: StackedRowOpts): StackedRow {
	const row = parent.createDiv({ cls: `myplugin-stacked-row${opts.cls ? " " + opts.cls : ""}` });
	const labels = row.createDiv({ cls: "myplugin-stacked-labels" });
	labels.createDiv({ cls: "myplugin-stacked-name", text: opts.name });
	if (opts.description) {
		labels.createDiv({ cls: "myplugin-stacked-desc", text: opts.description });
	}
	const content = row.createDiv({ cls: "myplugin-stacked-content" });
	return { row, content };
}
```

## The CSS

The layout only works with the paired styles. Paste into your `styles.css` and
match the prefix to the one above:

```css
.myplugin-stacked-row {
	padding: 12px 0;
	border-bottom: 1px solid var(--background-modifier-border);
}

.myplugin-stacked-row:last-child {
	border-bottom: none;
}

.myplugin-stacked-labels {
	margin-bottom: 8px;
}

.myplugin-stacked-name {
	font-weight: var(--font-semibold);
	color: var(--text-normal);
}

.myplugin-stacked-desc {
	margin-top: 2px;
	color: var(--text-muted);
	font-size: var(--font-smaller);
	line-height: 1.4;
}

.myplugin-stacked-content {
	width: 100%;
}
```

## Using it

```ts
const { content } = createStackedRow(containerEl, {
	name: "Template",
	description: "Markdown inserted for each new entry.",
});

// content is a full-width div. Put any long control inside it.
const textarea = content.createEl("textarea", { cls: "myplugin-template-input" });
textarea.value = this.settings.template;
textarea.addEventListener("input", async () => {
	this.settings.template = textarea.value;
	await this.plugin.saveData(this.settings);
});
```

## Notes

- The returned object also exposes `row`, the outer element, if you need to add a
  modifier class or hide the whole row conditionally.
- A stacked row is plain DOM, so it is not search-indexed by Obsidian's
  declarative settings the way a bound `control` field is. That is expected for any
  custom-rendered row; persist its value yourself in the control's event handler.
- This pattern suits any settings tab or modal with long-form controls (textareas,
  composite picker rows, multi-field forms) in a narrow panel.
