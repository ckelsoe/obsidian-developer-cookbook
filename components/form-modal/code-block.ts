// Code-block serializer for Obsidian plugins.
//
// Part of a reusable component library for Obsidian plugins. Turns a values object
// (for example the `values` from openSchemaForm) into a fenced code block of the
// shape "first optional positional line, then key:value lines". This matches the
// common pattern where a plugin's markdown code-block processor reads line 0 as a
// primary value and the rest as key:value overrides of its global settings.
//
// Pairs with schema-form.ts: a skipped or empty field is omitted, so the
// consumer's parser falls back to its global default for that key.
//
//   const res = await openSchemaForm(app, { ... });
//   if (res) {
//     const block = serializeCodeBlock({
//       identifier: "smiles",
//       primary: res.values.smiles,           // line 0, the SMILES string
//       fields: ["theme", "backgroundColor", "height"].map(k => ({ key: k, value: res.values[k] })),
//     });
//     editor.replaceSelection(block);
//   }
//   // ```smiles
//   // CN1C=NC2=...
//   // theme:oldschool
//   // height:150
//   // ```
//
// Dependencies: none.

export interface CodeBlockField {
	key: string;
	value: unknown;
}

export interface CodeBlockOptions {
	// The fence info string / language id (for example "smiles", "rubikCubePLL").
	identifier: string;
	// Optional first positional line, written before the key:value lines. Omit
	// for an all-key:value block.
	primary?: unknown;
	// Ordered key/value pairs.
	fields: CodeBlockField[];
	// Skip null / undefined / "" values so optional fields stay out of the block
	// (the consumer then uses its global default). Defaults to true.
	skipEmpty?: boolean;
}

// Build a fenced code block string. Does not insert it; the caller decides where
// it goes (typically editor.replaceSelection).
export function serializeCodeBlock(opts: CodeBlockOptions): string {
	const skipEmpty = opts.skipEmpty !== false;
	const lines: string[] = [];

	if (!isEmpty(opts.primary)) lines.push(stringifyValue(opts.primary));

	for (const { key, value } of opts.fields) {
		if (skipEmpty && isEmpty(value)) continue;
		lines.push(`${key}:${stringifyValue(value)}`);
	}

	const fence = "```";
	return `${fence}${opts.identifier}\n${lines.join("\n")}\n${fence}`;
}

function isEmpty(v: unknown): boolean {
	return v === null || v === undefined || v === "";
}

function stringifyValue(v: unknown): string {
	if (typeof v === "boolean") return v ? "true" : "false";
	return String(v);
}
