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

export default class DeveloperCookbookDemo extends Plugin {
	settings: DemoSettings = { ...DEFAULT_SETTINGS };

	async onload(): Promise<void> {
		await this.loadSettings();

		// Render the cookbook-demo blocks the card command inserts, so the
		// form -> block -> rendered output round trip is complete and the inserted
		// block is a visible card rather than inert text.
		this.registerMarkdownCodeBlockProcessor(CARD_ID, (source, el, ctx) =>
			this.renderCard(this.parseCard(source), el, () => void this.editCardBlock(source, el, ctx)));

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
		// Header row: title on the left, the edit affordance beside it. Laid out in
		// flow (not absolutely positioned) so the pencil never overlaps content.
		const header = card.createDiv({ cls: "cookbook-demo-card-header" });
		header.createDiv({ cls: "cookbook-demo-card-title", text: (values.title as string) || "Untitled card" });
		if (onEdit) {
			const btn = header.createEl("button", {
				cls: "cookbook-demo-card-edit",
				attr: { type: "button", "aria-label": "Edit card", title: "Edit card" },
			});
			setIcon(btn, "pencil");
			btn.addEventListener("click", () => onEdit());
		}
		const parts: string[] = [];
		if (values.size) parts.push(`size: ${String(values.size)}`);
		if (values.count !== undefined && values.count !== "") parts.push(`count: ${String(values.count)}`);
		if (color) parts.push(`color: ${color}`);
		card.createDiv({ cls: "cookbook-demo-card-meta", text: parts.join("   •   ") });
	}

	// Reopen the card's form pre-filled, then write the result back over the same
	// block in the file. Uses the rendered element's section info to find the
	// block's line range, so it works in both reading and live-preview modes.
	private async editCardBlock(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): Promise<void> {
		const res = await this.openCardForm(this.parseCard(source));
		if (!res) return;
		const info = ctx.getSectionInfo(el);
		const file = this.app.vault.getFileByPath(ctx.sourcePath);
		if (!info || !file) {
			new Notice("Could not locate the card to update.");
			return;
		}
		const newLines = this.cardBlock(res).split("\n");
		await this.app.vault.process(file, data => {
			const lines = data.split("\n");
			lines.splice(info.lineStart, info.lineEnd - info.lineStart + 1, ...newLines);
			return lines.join("\n");
		});
	}

	// ----- Mermaid: create, edit, build ---------------------------------------

	private async openMermaidForm(initial?: Record<string, unknown>): Promise<Record<string, unknown> | null> {
		const res = await openSchemaForm(this.app, {
			title: initial ? "Edit Mermaid flowchart" : "Insert a Mermaid diagram",
			cta: initial ? "Save" : "Insert",
			initialValues: initial,
			fields: [
				{ key: "direction", name: "Direction", type: "dropdown", default: "TD", options: [
					{ value: "TD", label: "Top-down" },
					{ value: "LR", label: "Left-right" },
					{ value: "BT", label: "Bottom-top" },
					{ value: "RL", label: "Right-left" },
				] },
				{ key: "from", name: "From node", type: "string", mandatory: true },
				{ key: "to", name: "To node", type: "string", mandatory: true },
				{ key: "label", name: "Edge label", type: "string" },
			],
			// A real, rendered Mermaid diagram that redraws as the user types, via
			// Obsidian's own MarkdownRenderer. No extra dependencies.
			preview: (values, el) => {
				void MarkdownRenderer.render(this.app, "```mermaid\n" + this.buildMermaid(values) + "\n```", el, "", this);
			},
		});
		return res ? res.values : null;
	}

	private async insertMermaid(editor: Editor): Promise<void> {
		const res = await this.openMermaidForm();
		if (res) this.insertBlock(editor, "```mermaid\n" + this.buildMermaid(res) + "\n```");
	}

	private buildMermaid(values: Record<string, unknown>): string {
		const dir = String(values.direction ?? "TD");
		const from = String(values.from ?? "A") || "A";
		const to = String(values.to ?? "B") || "B";
		const edge = values.label ? ` -->|${String(values.label)}| ` : " --> ";
		return `flowchart ${dir}\n    A["${from}"]${edge}B["${to}"]`;
	}

	private parseMermaid(body: string): Record<string, unknown> {
		const dir = body.match(/flowchart\s+(\w+)/)?.[1] ?? "TD";
		const m = body.match(/A\["([\s\S]*?)"\]\s*-->(?:\|([\s\S]*?)\|)?\s*B\["([\s\S]*?)"\]/);
		return { direction: dir, from: m?.[1] ?? "", label: m?.[2] ?? "", to: m?.[3] ?? "" };
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
		} else if (blk.lang === "mermaid") {
			const res = await this.openMermaidForm(this.parseMermaid(blk.body));
			if (res) replaceBlock(editor, blk, "```mermaid\n" + this.buildMermaid(res) + "\n```");
		} else {
			new Notice(`This demo can only edit "${CARD_ID}" and "mermaid" blocks.`);
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

// Locate the fenced code block the cursor sits inside, if any. Scans up for the
// opening fence and down for the closing one. Returns null when the cursor is
// not inside a complete block.
function blockAtCursor(editor: Editor): FencedBlock | null {
	const curLine = editor.getCursor().line;
	let start = -1;
	for (let i = curLine; i >= 0; i--) {
		if (editor.getLine(i).startsWith("```")) { start = i; break; }
	}
	if (start === -1) return null;
	const lang = editor.getLine(start).replace(/^`+/, "").trim();
	let end = -1;
	const total = editor.lineCount();
	for (let i = start + 1; i < total; i++) {
		if (editor.getLine(i).trim() === "```") { end = i; break; }
	}
	if (end === -1 || curLine > end) return null;
	const body: string[] = [];
	for (let i = start + 1; i < end; i++) body.push(editor.getLine(i));
	return { startLine: start, endLine: end, lang, body: body.join("\n") };
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
