// Developer Cookbook demo plugin.
//
// This plugin exists to demonstrate, and to compile-check, every component in
// the cookbook. Each command opens one component live. The component source it
// imports lives in ./components; copy any of those folders into your own plugin
// to use them. This file is a showcase, not something to copy.

import { Editor, MarkdownRenderer, Notice, Plugin } from "obsidian";

import { ConfirmModal, PromptModal } from "./components/modal-dialog/modal-dialog";
import { FormModal } from "./components/form-modal/form-modal";
import { openSchemaForm } from "./components/form-modal/schema-form";
import { serializeCodeBlock } from "./components/form-modal/code-block";
import { createIconChoice } from "./components/icon-choice/icon-choice";
import { createIconPicker, SelectIconModal } from "./components/icon-picker/icon-picker";
import { createColorPicker } from "./components/color-picker/color-picker";

export default class DeveloperCookbookDemo extends Plugin {
	onload(): void {
		this.addCommand({
			id: "confirm-dialog",
			name: "Show confirm dialog",
			callback: () => void this.demoConfirm(),
		});
		this.addCommand({
			id: "text-prompt",
			name: "Show text prompt",
			callback: () => void this.demoPrompt(),
		});
		this.addCommand({
			id: "browse-icons",
			name: "Browse icons",
			callback: () => this.demoIconPicker(),
		});
		this.addCommand({
			id: "component-gallery",
			name: "Show component gallery",
			callback: () => void this.demoGallery(),
		});
		this.addCommand({
			id: "build-code-block",
			name: "Build a code block from a form",
			editorCallback: (editor: Editor) => void this.demoSchemaForm(editor),
		});
		this.addCommand({
			id: "build-mermaid-diagram",
			name: "Build a Mermaid diagram with live preview",
			editorCallback: (editor: Editor) => void this.demoMermaid(editor),
		});
	}

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

	private async demoSchemaForm(editor: Editor): Promise<void> {
		const block = (values: Record<string, unknown>): string => serializeCodeBlock({
			identifier: "cookbook-demo",
			primary: values.title,
			fields: ["color", "size", "count"].map(k => ({ key: k, value: values[k] })),
		});
		const res = await openSchemaForm(this.app, {
			title: "Insert sample block",
			cta: "Insert",
			fields: [
				{ key: "title", name: "Title", type: "string", mandatory: true },
				{ key: "color", name: "Color", type: "color" },
				{ key: "size", name: "Size", type: "dropdown", options: ["small", "medium", "large"], default: "medium" },
				{ key: "count", name: "Count", type: "number", integer: true, min: 1, default: 1 },
			],
			// Live preview: the generated code block updates as the fields change.
			preview: (values, el) => { el.createEl("pre", { text: block(values) }); },
		});
		if (!res) return;
		editor.replaceSelection(block(res.values) + "\n");
	}

	private async demoMermaid(editor: Editor): Promise<void> {
		const res = await openSchemaForm(this.app, {
			title: "Insert Mermaid flowchart",
			cta: "Insert",
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
			// The ultimate feature: a real, rendered Mermaid diagram that redraws as
			// the user types, using Obsidian's own MarkdownRenderer. No extra deps.
			preview: (values, el) => {
				const md = "```mermaid\n" + this.buildMermaid(values) + "\n```";
				void MarkdownRenderer.render(this.app, md, el, "", this);
			},
		});
		if (!res) return;
		editor.replaceSelection("```mermaid\n" + this.buildMermaid(res.values) + "\n```\n");
	}

	private buildMermaid(values: Record<string, unknown>): string {
		const dir = String(values.direction ?? "TD");
		const from = String(values.from ?? "A") || "A";
		const to = String(values.to ?? "B") || "B";
		const edge = values.label ? ` -->|${String(values.label)}| ` : " --> ";
		return `flowchart ${dir}\n    A["${from}"]${edge}B["${to}"]`;
	}
}
