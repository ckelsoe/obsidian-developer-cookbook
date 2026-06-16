// Declarative form layer for Obsidian plugins. Targets Obsidian 1.13+.
//
// Part of a reusable component library for Obsidian plugins. This sits on top of the
// FormModal shell (form-modal.ts, same folder) and lets you describe a form as
// data instead of writing render code. You pass an array of field definitions
// (which maps directly from YAML or JSON), and openSchemaForm renders them using
// Obsidian's own native Setting controls, validates, and resolves the result.
//
// The field model follows the create-content / build-a-code-block use case:
// every field can be marked mandatory by the developer, and any non-mandatory
// field can be skipped by the user to fall back to a global setting. A skipped
// field is reported as skipped and left out of the values map, so a serializer
// can omit it (and the consumer's parser then uses its global default).
//
// To use: copy form-modal.ts, form-modal.css, and this file into your plugin.
//
//   const res = await openSchemaForm(this.app, {
//     title: "Insert molecule",
//     cta: "Insert",
//     fields: [
//       { key: "smiles", name: "SMILES", type: "string", mandatory: true,
//         pattern: "^[A-Za-z0-9@+\\-\\[\\]()=#$%./\\\\]+$" },
//       { key: "theme", name: "Theme", type: "dropdown",
//         options: ["light", "dark", "oldschool"] },
//       { key: "backgroundColor", name: "Background", type: "color" },   // skippable
//       { key: "height", name: "Height", type: "number", integer: true, min: 1, default: 150 },
//     ],
//   });
//   if (res) {
//     // res.values = { smiles, theme, height }  (skipped/empty omitted)
//     // res.fields.backgroundColor = { valid: true, skipped: true, result: undefined }
//   }
//
// Dependencies: the `obsidian` package and the FormModal shell in this folder.
// CSS namespace: dcb- (dcb-field-invalid and dcb-field-explanation live in
// form-modal.css).

import { App, Setting } from "obsidian";
import { FormModal } from "./form-modal";

// "string" is Altarok's name for a single-line text field; it is an alias for
// "text". The other types extend his color | string | dropdown set with the
// remaining native Setting controls.
export type FieldType = "string" | "text" | "textarea" | "number" | "toggle" | "dropdown" | "slider" | "color";

export interface SchemaField {
	// Output property name and, for serializers, the code-block key.
	key: string;
	// Display label. Defaults to key.
	name?: string;
	// Short helper text under the label.
	description?: string;
	// Optional longer help for first-time users, rendered full-width below the row.
	explanation?: string;
	type: FieldType;
	// Optional regex (as a string, so it survives YAML/JSON) validating a text or
	// string value. Checked when the value is non-empty, or always if mandatory.
	pattern?: string;
	// Optional programmatic validator for cases a regex cannot express. Return an
	// error string to block, or null to allow.
	validate?: (value: string) => string | null;
	// Developer-set: the user must provide a value (cannot be empty or skipped).
	mandatory?: boolean;
	// Dropdown choices: bare values or explicit { value, label } pairs.
	options?: Array<string | { value: string; label: string }>;
	default?: string | number | boolean;
	placeholder?: string;
	// Number / slider constraints.
	integer?: boolean;
	min?: number;
	max?: number;
	step?: number;
}

export interface FieldResult {
	valid: boolean;
	skipped: boolean;
	result: unknown;
}

export interface SchemaFormResult {
	// Per-field outcome, matching Altarok's { valid, skipped, result } shape.
	fields: Record<string, FieldResult>;
	// Convenience map of the fields that were set and not skipped. Skipped fields
	// and empty optional fields are omitted, so a serializer can leave them out
	// and the consumer falls back to its global setting.
	values: Record<string, unknown>;
}

export interface SchemaFormOptions {
	title: string;
	cta?: string;
	destructive?: boolean;
	fields: SchemaField[];
	// Seed the form with existing values, keyed by field key, overriding each
	// field's `default`. This is what turns the form into an editor: parse an
	// existing block into a values map, pass it here, and the form opens pre-filled.
	initialValues?: Record<string, unknown>;
	// Optional live preview pane rendered at the bottom of the modal. Called on
	// open and after every field change, with the current effective values
	// (skipped and empty fields omitted, the same map you get back as the result's
	// `values`). Render whatever you like into `previewEl`: the generated code
	// block, a rendered diagram, a summary. The pane is cleared before each call.
	preview?: (values: Record<string, unknown>, previewEl: HTMLElement) => void;
}

const isTextual = (t: FieldType): boolean => t === "string" || t === "text" || t === "textarea";

// Open a declarative form modal. Resolves the result, or null if the user
// cancelled or dismissed.
export async function openSchemaForm(
	app: App,
	opts: SchemaFormOptions,
): Promise<SchemaFormResult | null> {
	const values: Record<string, unknown> = {};
	const skipped = new Set<string>();
	const errors = new Set<string>();
	for (const f of opts.fields) {
		const seed = opts.initialValues?.[f.key];
		values[f.key] = seed !== undefined ? seed : defaultFor(f);
	}

	const submitted = await new FormModal(app, {
		title: opts.title,
		cta: opts.cta,
		destructive: opts.destructive,
		render: (body, form) => {
			// Late-bound so renderField's initial revalidate (which fires before the
			// pane is created) is a harmless no-op; the pane lives below the fields.
			let previewEl: HTMLElement | null = null;
			const recompute = (): void => {
				form.setSubmitEnabled(errors.size === 0);
				if (opts.preview && previewEl) {
					previewEl.empty();
					opts.preview(snapshot(values, skipped, opts.fields), previewEl);
				}
			};
			for (const f of opts.fields) renderField(body, f, values, skipped, errors, recompute);
			if (opts.preview) previewEl = body.createDiv({ cls: "dcb-form-preview" });
			recompute();
		},
		onSubmit: () => errors.size === 0,
	}).ask();

	if (!submitted) return null;

	const fields: Record<string, FieldResult> = {};
	for (const f of opts.fields) {
		const isSkipped = skipped.has(f.key);
		fields[f.key] = {
			valid: !errors.has(f.key),
			skipped: isSkipped,
			result: isSkipped ? undefined : values[f.key],
		};
	}
	return { fields, values: snapshot(values, skipped, opts.fields) };
}

// The effective values: non-skipped fields with a non-empty value. This is what
// the result exposes and what the live preview receives, so a preview shows
// exactly what the final output will contain.
function snapshot(
	values: Record<string, unknown>,
	skipped: Set<string>,
	fields: SchemaField[],
): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const f of fields) {
		if (skipped.has(f.key)) continue;
		const v = values[f.key];
		if (v === "" || v === undefined) continue;
		out[f.key] = v;
	}
	return out;
}

function defaultFor(f: SchemaField): unknown {
	if (isTextual(f.type)) return (f.default as string) ?? "";
	switch (f.type) {
		case "number":
			return (f.default as number) ?? f.min ?? 0;
		case "toggle":
			return (f.default as boolean) ?? false;
		case "dropdown":
			return (f.default as string) ?? optionValue(f.options?.[0]);
		case "slider":
			return (f.default as number) ?? f.min ?? 0;
		case "color":
			return (f.default as string) ?? "";
	}
	// Unreachable: the textual types are handled above and the switch covers the
	// rest, but the compiler cannot prove the union is exhausted across both.
	return undefined;
}

function optionValue(o: string | { value: string; label: string } | undefined): string {
	if (o === undefined) return "";
	return typeof o === "string" ? o : o.value;
}

function renderField(
	body: HTMLElement,
	f: SchemaField,
	values: Record<string, unknown>,
	skipped: Set<string>,
	errors: Set<string>,
	recompute: () => void,
): void {
	const setting = new Setting(body).setName(f.name ?? f.key);
	if (f.description) setting.setDesc(f.description);

	// Build the type's control and capture a way to disable it (for skip) and to
	// re-run its validation (for skip toggling and live input).
	const built = buildControl(setting, f, values, () => skipped.has(f.key), errors, recompute);

	// Non-mandatory fields get a "skip" toggle: when on, the field falls back to
	// the consumer's global setting, the control is disabled, and it never blocks
	// submission.
	if (!f.mandatory) {
		setting.addToggle(t => {
			t.setTooltip("Skip (use the global setting)");
			t.setValue(false);
			t.onChange(on => {
				if (on) skipped.add(f.key);
				else skipped.delete(f.key);
				built.setDisabled(on);
				built.revalidate();
				recompute();
			});
		});
	}

	if (f.explanation) {
		body.createDiv({ cls: "dcb-field-explanation", text: f.explanation });
	}

	// Seed initial validity (a mandatory-but-empty field starts blocking).
	built.revalidate();
}

interface BuiltControl {
	setDisabled(disabled: boolean): void;
	revalidate(): void;
}

function buildControl(
	setting: Setting,
	f: SchemaField,
	values: Record<string, unknown>,
	isSkipped: () => boolean,
	errors: Set<string>,
	recompute: () => void,
): BuiltControl {
	// Compute and apply validity for a textual/number field given its raw value.
	const applyError = (invalid: boolean, inputEl?: HTMLElement): void => {
		if (invalid && !isSkipped()) errors.add(f.key);
		else errors.delete(f.key);
		inputEl?.toggleClass("dcb-field-invalid", invalid && !isSkipped());
	};

	if (isTextual(f.type)) {
		const re = f.pattern ? new RegExp(f.pattern) : null;
		const check = (v: string): boolean => {
			if (isSkipped()) return true;
			if (v.trim() === "") return !f.mandatory; // empty: ok only if optional
			if (re && !re.test(v)) return false;
			if (f.validate && f.validate(v) !== null) return false;
			return true;
		};
		let inputEl: HTMLInputElement | HTMLTextAreaElement | null = null;
		let setDisabled: (d: boolean) => void = () => {};
		const wire = (el: HTMLInputElement | HTMLTextAreaElement): void => {
			inputEl = el;
			el.value = (values[f.key] as string) ?? "";
			el.addEventListener("input", () => {
				values[f.key] = el.value;
				applyError(!check(el.value), el);
				recompute();
			});
		};
		if (f.type === "textarea") {
			setting.addTextArea(t => { if (f.placeholder) t.setPlaceholder(f.placeholder); wire(t.inputEl); setDisabled = d => t.setDisabled(d); });
		} else {
			setting.addText(t => { if (f.placeholder) t.setPlaceholder(f.placeholder); wire(t.inputEl); setDisabled = d => t.setDisabled(d); });
		}
		return {
			setDisabled,
			revalidate: () => applyError(!check((values[f.key] as string) ?? ""), inputEl ?? undefined),
		};
	}

	if (f.type === "number") {
		let inputEl: HTMLInputElement | null = null;
		let setDisabled: (d: boolean) => void = () => {};
		const check = (raw: string): boolean => {
			if (isSkipped()) return true;
			if (raw.trim() === "") return !f.mandatory;
			const num = Number(raw);
			if (Number.isNaN(num)) return false;
			if (f.integer && !Number.isInteger(num)) return false;
			if (f.min !== undefined && num < f.min) return false;
			if (f.max !== undefined && num > f.max) return false;
			return true;
		};
		setting.addText(t => {
			inputEl = t.inputEl;
			t.setValue(String(values[f.key] ?? ""));
			setDisabled = d => t.setDisabled(d);
			t.inputEl.addEventListener("input", () => {
				const raw = t.inputEl.value;
				const ok = check(raw);
				if (ok && raw.trim() !== "") values[f.key] = Number(raw);
				else if (raw.trim() === "") values[f.key] = "";
				applyError(!ok, t.inputEl);
				recompute();
			});
		});
		return {
			setDisabled,
			revalidate: () => applyError(!check(String(values[f.key] ?? "")), inputEl ?? undefined),
		};
	}

	// Non-validating controls: toggle, dropdown, slider, color. Always valid, but
	// they must still call recompute() on change so the submit gate and the live
	// preview update, exactly like the text and number controls above.
	let setDisabled: (d: boolean) => void = () => {};
	switch (f.type) {
		case "toggle":
			setting.addToggle(t => { t.setValue(Boolean(values[f.key])); t.onChange(v => { values[f.key] = v; recompute(); }); setDisabled = d => t.setDisabled(d); });
			break;
		case "dropdown":
			setting.addDropdown(d => {
				for (const o of f.options ?? []) {
					if (typeof o === "string") d.addOption(o, o);
					else d.addOption(o.value, o.label);
				}
				d.setValue(String(values[f.key] ?? ""));
				d.onChange(v => { values[f.key] = v; recompute(); });
				setDisabled = dis => d.setDisabled(dis);
			});
			break;
		case "slider":
			setting.addSlider(s => {
				s.setLimits(f.min ?? 0, f.max ?? 100, f.step ?? 1)
					.setValue(Number(values[f.key] ?? f.min ?? 0))
					.setDynamicTooltip();
				s.onChange(v => { values[f.key] = v; recompute(); });
				setDisabled = d => s.setDisabled(d);
			});
			break;
		case "color":
			setting.addColorPicker(c => {
				const cur = values[f.key] as string;
				if (cur) c.setValue(cur);
				c.onChange(v => { values[f.key] = v; recompute(); });
				setDisabled = d => c.setDisabled(d);
			});
			break;
	}
	return { setDisabled, revalidate: () => {} };
}
