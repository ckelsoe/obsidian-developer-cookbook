// Developer Cookbook demo plugin.
//
// This plugin exists to demonstrate, and to compile-check, every component in
// the cookbook. The component source it imports lives in ./components; copy any
// of those folders into your own plugin to use them. This file is a showcase,
// not something to copy.

import { App, Editor, MarkdownRenderer, type MarkdownPostProcessorContext, Notice, Plugin, PluginSettingTab, setIcon, type SettingDefinitionItem } from "obsidian";

import { ConfirmModal, PromptModal } from "./components/modal-dialog/modal-dialog";
import { FormModal } from "./components/form-modal/form-modal";
import { openSchemaForm } from "./components/form-modal/schema-form";
import { serializeCodeBlock } from "./components/form-modal/code-block";
import { createIconChoice } from "./components/icon-choice/icon-choice";
import { createIconPicker, SelectIconModal } from "./components/icon-picker/icon-picker";
import { createColorPicker } from "./components/color-picker/color-picker";

interface DemoSettings {
	color?: string;
	icon?: string;
	markerIcon?: string;
}

const DEFAULT_SETTINGS: DemoSettings = {};

// The fenced-block language the "Insert a card" command writes and this plugin
// renders. Pairing a serializer with a code-block processor like this is the
// create-content pattern a real plugin (Tasks, a diagram plugin, etc.) follows.
const CARD_ID = "cookbook-demo";

// The demo renders its Mermaid diagrams under its OWN block language rather than
// native ```mermaid. That is the whole point: a block this plugin renders can
// carry an inline edit pencil, while a natively-rendered ```mermaid block cannot
// (Obsidian owns that DOM), forcing the clunky cursor-in-source command instead.
const MERMAID_ID = "cookbook-mermaid";

export default class DeveloperCookbookDemo extends Plugin {
	settings: DemoSettings = { ...DEFAULT_SETTINGS };

	async onload(): Promise<void> {
		await this.loadSettings();

		// Render the cookbook-demo blocks the card command inserts, so the
		// form -> block -> rendered output round trip is complete and the inserted
		// block is a visible card rather than inert text.
		this.registerMarkdownCodeBlockProcessor(CARD_ID, (source, el, ctx) =>
			this.renderCard(this.parseCard(source), el, () => void this.editCardBlock(source, el, ctx)));
		this.registerMarkdownCodeBlockProcessor(MERMAID_ID, (source, el, ctx) =>
			this.renderMermaid(source, el, () => void this.editMermaidBlock(source, el, ctx)));

		this.addCommand({ id: "confirm-dialog", name: "Show confirm dialog", callback: () => void this.demoConfirm() });
		this.addCommand({ id: "text-prompt", name: "Show text prompt", callback: () => void this.demoPrompt() });
		this.addCommand({ id: "browse-icons", name: "Browse icons", callback: () => this.demoIconPicker() });
		this.addCommand({ id: "component-gallery", name: "Show component gallery", callback: () => void this.demoGallery() });
		this.addCommand({ id: "insert-card", name: "Insert a card", editorCallback: e => void this.insertCard(e) });
		this.addCommand({ id: "insert-mermaid", name: "Insert a Mermaid diagram", editorCallback: e => void this.insertMermaid(e) });
		this.addCommand({ id: "edit-block", name: "Edit the card or diagram at the cursor", editorCallback: e => void this.editBlockAtCursor(e) });

		this.addSettingTab(new DemoSettingTab(this.app, this));
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, (await this.loadData()) as Partial<DemoSettings> | null);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	// ----- Simple modal demos -------------------------------------------------

	private async demoConfirm(): Promise<void> {
		const ok = await new ConfirmModal(this.app, {
			title: "Delete note",
			message: "Remove this note from the vault?",
			detail: "You can undo this with Ctrl/Cmd+Z if the file is open.",
			cta: "Delete",
			destructive: true,
		}).ask();
		new Notice(ok ? "Confirmed." : "Cancelled.");
	}

	private async demoPrompt(): Promise<void> {
		const name = await new PromptModal(this.app, {
			title: "Rename",
			label: "New name",
			placeholder: "Untitled",
			validate: v => (v.trim() === "" ? "Name cannot be empty." : null),
		}).ask();
		new Notice(name === null ? "Cancelled." : `Entered: ${name}`);
	}

	private demoIconPicker(): void {
		new SelectIconModal(this.app, "", id => new Notice(`Picked icon: ${id}`)).open();
	}

	private async demoGallery(): Promise<void> {
		await new FormModal(this.app, {
			title: "Component gallery",
			cta: "Done",
			render: body => {
				body.createEl("p", { text: "Curated icon choice:" });
				createIconChoice(body, {
					icons: ["pencil", "star", "bookmark", "tag", "flame"],
					onChange: id => { new Notice(`icon-choice: ${id}`); },
				});
				body.createEl("p", { text: "Browse-all icon picker:" });
				createIconPicker(body, {
					app: this.app,
					onChange: id => { new Notice(`icon-picker: ${id ?? "(cleared)"}`); },
				});
				body.createEl("p", { text: "Color picker:" });
				createColorPicker(body, {
					onChange: v => { new Notice(`color: ${v ?? "(reset)"}`); },
				});
			},
			onSubmit: () => {},
		}).ask();
	}

	// ----- Card: create, edit, render -----------------------------------------

	// The form, shared by the insert command and the edit flow. Passing
	// `initial` turns it from a create form into an edit form (pre-filled).
	private async openCardForm(initial?: Record<string, unknown>): Promise<Record<string, unknown> | null> {
		const res = await openSchemaForm(this.app, {
			title: initial ? "Edit card" : "Insert a card",
			cta: initial ? "Save" : "Insert",
			initialValues: initial,
			fields: [
				{
					key: "title", name: "Title", type: "string", mandatory: true,
					explanation: "This form builds a card. The preview below is exactly what gets inserted into your note, and you can reopen it later with \"Edit the card or diagram at the cursor\".",
				},
				{ key: "color", name: "Accent color", type: "color" },
				{ key: "size", name: "Size", type: "dropdown", options: ["small", "medium", "large"], default: "medium" },
				{ key: "count", name: "Count", type: "number", integer: true, min: 1, default: 1 },
			],
			// Live preview is the actual rendered card, so what you see is what you get.
			preview: (values, el) => this.renderCard(values, el),
		});
		return res ? res.values : null;
	}

	private async insertCard(editor: Editor): Promise<void> {
		const res = await this.openCardForm();
		if (res) this.insertBlock(editor, this.cardBlock(res));
	}

	private cardBlock(values: Record<string, unknown>): string {
		return serializeCodeBlock({
			identifier: CARD_ID,
			primary: values.title,
			fields: ["color", "size", "count"].map(k => ({ key: k, value: values[k] })),
		});
	}

	private parseCard(body: string): Record<string, unknown> {
		const { primary, kv } = parseKeyValueBlock(body);
		return {
			title: primary,
			color: kv.color,
			size: kv.size,
			count: kv.count ? Number(kv.count) : undefined,
		};
	}

	// `onEdit`, when given, adds a clickable Edit button to the card. The form
	// preview omits it (no onEdit); the rendered-in-note block includes it so the
	// card can be reopened by clicking, not only via the command.
	private renderCard(values: Record<string, unknown>, el: HTMLElement, onEdit?: () => void): void {
		const card = el.createDiv({ cls: "cookbook-demo-card" });
		const color = values.color as string | undefined;
		if (color) card.style.borderInlineStartColor = color;
		card.createDiv({ cls: "cookbook-demo-card-title", text: (values.title as string) || "Untitled card" });
		const parts: string[] = [];
		if (values.size) parts.push(`size: ${String(values.size)}`);
		if (values.count !== undefined && values.count !== "") parts.push(`count: ${String(values.count)}`);
		if (color) parts.push(`color: ${color}`);
		card.createDiv({ cls: "cookbook-demo-card-meta", text: parts.join("   •   ") });
		// Hover-revealed edit affordance in the top-right, offset to sit just left
		// of Obsidian's own live-preview edit marker rather than over it. Whether
		// this appears at all is the plugin's choice, made here per block type.
		if (onEdit) {
			const btn = card.createEl("button", {
				cls: "cookbook-demo-card-edit",
				attr: { type: "button", "aria-label": "Edit card", title: "Edit card" },
			});
			setIcon(btn, "pencil");
			btn.addEventListener("click", () => onEdit());
		}
	}

	// Reopen the card's form pre-filled, then write the result back over the block.
	private async editCardBlock(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): Promise<void> {
		const res = await this.openCardForm(this.parseCard(source));
		if (res) await this.replaceRenderedBlock(el, ctx, this.cardBlock(res));
	}

	// Render a Mermaid diagram under this plugin's own block language, with a hover
	// pencil. Because this plugin renders it, it can carry the edit affordance; a
	// native ```mermaid block cannot, which is the whole reason for the own-language
	// approach.
	private renderMermaid(source: string, el: HTMLElement, onEdit?: () => void): void {
		const wrap = el.createDiv({ cls: "cookbook-demo-mermaid" });
		void MarkdownRenderer.render(this.app, "```mermaid\n" + source + "\n```", wrap, "", this);
		if (onEdit) {
			const btn = wrap.createEl("button", {
				cls: "cookbook-demo-card-edit",
				attr: { type: "button", "aria-label": "Edit diagram", title: "Edit diagram" },
			});
			setIcon(btn, "pencil");
			btn.addEventListener("click", () => onEdit());
		}
	}

	private async editMermaidBlock(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): Promise<void> {
		const next = await this.openMermaidEditor(source);
		if (next !== null) await this.replaceRenderedBlock(el, ctx, "```" + MERMAID_ID + "\n" + next + "\n```");
	}

	// Replace the rendered block this element belongs to, located by the section's
	// line range. Works in reading and live-preview modes with no editor cursor,
	// which is why the inline pencils can edit from either mode.
	private async replaceRenderedBlock(el: HTMLElement, ctx: MarkdownPostProcessorContext, newBlock: string): Promise<void> {
		const info = ctx.getSectionInfo(el);
		const file = this.app.vault.getFileByPath(ctx.sourcePath);
		if (!info || !file) {
			new Notice("Could not locate the block to update.");
			return;
		}
		const newLines = newBlock.split("\n");
		await this.app.vault.process(file, data => {
			const lines = data.split("\n");
			lines.splice(info.lineStart, info.lineEnd - info.lineStart + 1, ...newLines);
			return lines.join("\n");
		});
	}

	// ----- Mermaid: a free-form textarea with a live rendered preview ----------
	//
	// Uses the FormModal render callback directly (not the declarative form) so the
	// body is a full-width code textarea: type raw Mermaid, see it render in real
	// time. This is the "build the block content and watch it render" pattern, the
	// general shape of Altarok's rubikCubePLL editor. The block body IS the value,
	// so there is no field parsing on the way in or out.
	private async openMermaidEditor(initial: string): Promise<string | null> {
		let source = initial;
		const editing = initial.trim() !== "";
		const ok = await new FormModal(this.app, {
			title: editing ? "Edit Mermaid diagram" : "Insert a Mermaid diagram",
			cta: editing ? "Save" : "Insert",
			render: (body, form) => {
				const input = body.createEl("textarea", {
					cls: "cookbook-demo-mermaid-input",
					attr: { placeholder: "flowchart TD\n    A --> B" },
				});
				input.value = source;
				const preview = body.createDiv({ cls: "dcb-form-preview" });
				const refresh = (): void => {
					form.setSubmitEnabled(source.trim() !== "");
					preview.empty();
					void MarkdownRenderer.render(this.app, "```mermaid\n" + source + "\n```", preview, "", this);
				};
				input.addEventListener("input", () => { source = input.value; refresh(); });
				refresh();
			},
			onSubmit: () => source.trim() !== "",
		}).ask();
		return ok ? source : null;
	}

	private async insertMermaid(editor: Editor): Promise<void> {
		const source = await this.openMermaidEditor("");
		if (source !== null) this.insertBlock(editor, "```" + MERMAID_ID + "\n" + source + "\n```");
	}

	// ----- Edit the block at the cursor ---------------------------------------

	private async editBlockAtCursor(editor: Editor): Promise<void> {
		const blk = blockAtCursor(editor);
		if (!blk) {
			new Notice("Put the cursor inside a card or Mermaid block first.");
			return;
		}
		if (blk.lang === CARD_ID) {
			const res = await this.openCardForm(this.parseCard(blk.body));
			if (res) replaceBlock(editor, blk, this.cardBlock(res));
		} else if (blk.lang === MERMAID_ID) {
			const source = await this.openMermaidEditor(blk.body);
			if (source !== null) replaceBlock(editor, blk, "```" + MERMAID_ID + "\n" + source + "\n```");
		} else {
			new Notice(`This demo can only edit "${CARD_ID}" and "${MERMAID_ID}" blocks.`);
		}
	}

	// ----- Editor helpers -----------------------------------------------------

	// Insert a fenced block, guaranteeing its opening fence starts on its own
	// line. Without this, running the command mid-line glues ```lang onto the
	// preceding text and the fence never parses.
	private insertBlock(editor: Editor, block: string): void {
		const cursor = editor.getCursor();
		const before = editor.getLine(cursor.line).slice(0, cursor.ch);
		const lead = before.trim().length > 0 ? "\n\n" : "";
		editor.replaceSelection(`${lead}${block}\n`);
	}
}

interface FencedBlock {
	startLine: number;
	endLine: number;
	lang: string;
	body: string;
}

// Locate the fenced code block whose range contains the cursor, if any. Walks the
// document block by block from the top so the cursor is matched against complete
// [open, close] ranges. This avoids the trap of scanning upward and landing on a
// closing fence (which has no language), which is what made "Edit" report the
// wrong block type when the cursor was not squarely inside the source.
function blockAtCursor(editor: Editor): FencedBlock | null {
	const cur = editor.getCursor().line;
	const total = editor.lineCount();
	let i = 0;
	while (i < total) {
		const open = editor.getLine(i);
		if (open.startsWith("```")) {
			const lang = open.replace(/^`+/, "").trim();
			let end = -1;
			for (let j = i + 1; j < total; j++) {
				if (editor.getLine(j).trim() === "```") { end = j; break; }
			}
			if (end === -1) return null; // unterminated block; nothing to edit
			if (cur >= i && cur <= end) {
				const body: string[] = [];
				for (let k = i + 1; k < end; k++) body.push(editor.getLine(k));
				return { startLine: i, endLine: end, lang, body: body.join("\n") };
			}
			i = end + 1;
		} else {
			i++;
		}
	}
	return null;
}

function replaceBlock(editor: Editor, blk: FencedBlock, newBlock: string): void {
	editor.replaceRange(
		newBlock,
		{ line: blk.startLine, ch: 0 },
		{ line: blk.endLine, ch: editor.getLine(blk.endLine).length },
	);
}

// Parse a "line-0 primary, then key:value lines" block body. The inverse of the
// code-block serializer.
function parseKeyValueBlock(body: string): { primary?: string; kv: Record<string, string> } {
	const lines = body.split("\n").map(l => l.trim()).filter(l => l.length > 0);
	let primary: string | undefined;
	const kv: Record<string, string> = {};
	for (const line of lines) {
		const i = line.indexOf(":");
		if (i === -1) {
			if (primary === undefined) primary = line;
			continue;
		}
		kv[line.slice(0, i).trim()] = line.slice(i + 1).trim();
	}
	return { primary, kv };
}

// A settings tab is the natural home for the inline pickers (the modals are
// command-triggered; the pickers live in settings). Uses the declarative 1.13
// API: each picker is a `render` item mounted into the row's control element,
// and its value is persisted by hand since render rows are not auto-bound.
class DemoSettingTab extends PluginSettingTab {
	private readonly demoPlugin: DeveloperCookbookDemo;

	constructor(app: App, plugin: DeveloperCookbookDemo) {
		super(app, plugin);
		this.demoPlugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		const plugin = this.demoPlugin;
		const save = (): void => void plugin.saveSettings();
		return [
			{
				type: "group",
				heading: "Inline component showcase",
				items: [
					{
						name: "Color picker",
						desc: "Theme swatches, a hex field, and the native picker. Source: components/color-picker.",
						render: setting => {
							createColorPicker(setting.controlEl, {
								current: plugin.settings.color,
								onChange: v => { plugin.settings.color = v; save(); },
							});
						},
					},
					{
						name: "Icon picker",
						desc: "Browse every registered icon in a virtualized grid. Source: components/icon-picker.",
						render: setting => {
							createIconPicker(setting.controlEl, {
								app: this.app,
								current: plugin.settings.icon,
								onChange: id => { plugin.settings.icon = id; save(); },
							});
						},
					},
					{
						name: "Curated icon choice",
						desc: "Pick one from a small developer-supplied set. Source: components/icon-choice.",
						render: setting => {
							createIconChoice(setting.controlEl, {
								icons: ["pencil", "star", "bookmark", "tag", "flame"],
								current: plugin.settings.markerIcon,
								onChange: id => { plugin.settings.markerIcon = id; save(); },
							});
						},
					},
				],
			},
		];
	}
}
