// Self-contained modal building blocks for Obsidian plugins.
//
// Part of a reusable component library for Obsidian plugins. To use: copy this file
// into your plugin's source folder and paste modal-dialog.css into your
// styles.css.
//
// Dependencies: the `obsidian` package only. No plugin instance, no domain
// types. Each modal takes plain values plus a way to read the answer back.
//
// Both modals are Promise-based, so a caller can await the answer inline:
//
//   const ok = await new ConfirmModal(this.app, {
//     title: "Delete note",
//     message: "Remove this note from the vault?",
//     cta: "Delete",
//     destructive: true,
//   }).ask();
//   if (ok) await this.doDelete();
//
//   const name = await new PromptModal(this.app, {
//     title: "Rename feed",
//     label: "New name",
//     initialValue: current,
//     validate: v => (v.trim() === "" ? "Name cannot be empty." : null),
//   }).ask();
//   if (name !== null) await this.rename(name);
//
// CSS namespace: dcb- (safe to leave as-is; two plugins never share a DOM, so
// the prefix cannot collide). Rename via find-replace if you prefer your own.

import { App, ButtonComponent, Modal, Setting } from "obsidian";

export interface ConfirmModalOptions {
	title: string;
	message: string;
	// Optional second line shown under the message in muted text. Use it for
	// the "this cannot be undone" style caveat so the main message stays short.
	detail?: string;
	// Confirm button label. Keep it sentence case for the scorecard. Defaults
	// to "Confirm".
	cta?: string;
	// Render the confirm button in the destructive (red) style for deletes and
	// other irreversible actions.
	destructive?: boolean;
}

// A yes/no confirmation. ask() resolves true when the user confirms and false
// for every other exit (Cancel, Escape, click-out), so an awaiting caller is
// never left hanging on a dismissed dialog.
export class ConfirmModal extends Modal {
	private readonly options: ConfirmModalOptions;
	private settled = false;
	private resolve!: (value: boolean) => void;

	constructor(app: App, options: ConfirmModalOptions) {
		super(app);
		this.options = options;
	}

	ask(): Promise<boolean> {
		return new Promise(resolve => {
			this.resolve = resolve;
			this.open();
		});
	}

	// Resolve exactly once. Guards against the confirm path and the onClose
	// path both trying to settle the same promise.
	private settle(value: boolean): void {
		if (this.settled) return;
		this.settled = true;
		this.resolve(value);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("dcb-modal");
		contentEl.createEl("h3", { text: this.options.title });
		contentEl.createEl("p", { cls: "dcb-modal-message", text: this.options.message });
		if (this.options.detail) {
			contentEl.createEl("p", { cls: "dcb-modal-detail", text: this.options.detail });
		}

		new Setting(contentEl)
			.addButton(b => {
				b.setButtonText(this.options.cta ?? "Confirm").onClick(() => {
					this.settle(true);
					this.close();
				});
				if (this.options.destructive) b.setDestructive();
				else b.setCta();
			})
			.addButton(b => b.setButtonText("Cancel").onClick(() => this.close()));
	}

	onClose(): void {
		this.contentEl.empty();
		// Dismissed without confirming: settle false so awaiting callers resume.
		this.settle(false);
	}
}

export interface PromptModalOptions {
	title: string;
	// Field label rendered above the input.
	label?: string;
	placeholder?: string;
	initialValue?: string;
	// Submit button label. Defaults to "Submit".
	cta?: string;
	// Return an error string to block submission and show it inline, or null to
	// allow it. Runs on every keystroke and on submit. Omit to accept any value
	// including empty.
	validate?: (value: string) => string | null;
}

// A single-line text prompt. ask() resolves the entered string, or null if the
// user cancels or dismisses. While validate() returns an error the submit
// button is disabled and the error shows beneath the input.
export class PromptModal extends Modal {
	private readonly options: PromptModalOptions;
	private value: string;
	private settled = false;
	private resolve!: (value: string | null) => void;
	private focusTimer: number | null = null;

	constructor(app: App, options: PromptModalOptions) {
		super(app);
		this.options = options;
		this.value = options.initialValue ?? "";
	}

	ask(): Promise<string | null> {
		return new Promise(resolve => {
			this.resolve = resolve;
			this.open();
		});
	}

	private settle(value: string | null): void {
		if (this.settled) return;
		this.settled = true;
		this.resolve(value);
	}

	private currentError(): string | null {
		return this.options.validate ? this.options.validate(this.value) : null;
	}

	private submit(): void {
		if (this.currentError() !== null) return;
		this.settle(this.value);
		this.close();
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("dcb-modal");
		contentEl.createEl("h3", { text: this.options.title });

		const field = contentEl.createDiv({ cls: "dcb-modal-field" });
		if (this.options.label) {
			field.createEl("label", { cls: "dcb-modal-label", text: this.options.label });
		}
		const input = field.createEl("input", {
			cls: "dcb-modal-input",
			attr: { type: "text", placeholder: this.options.placeholder ?? "" },
		});
		input.value = this.value;
		const errorEl = field.createDiv({ cls: "dcb-modal-error" });

		let submitBtn: ButtonComponent;
		const refresh = (): void => {
			const msg = this.currentError();
			errorEl.setText(msg ?? "");
			errorEl.toggleClass("is-visible", msg !== null);
			submitBtn.setDisabled(msg !== null);
		};

		input.addEventListener("input", () => {
			this.value = input.value;
			refresh();
		});
		input.addEventListener("keydown", evt => {
			if (evt.key === "Enter") {
				evt.preventDefault();
				this.submit();
			}
		});

		new Setting(contentEl)
			.addButton(b => {
				submitBtn = b;
				b.setButtonText(this.options.cta ?? "Submit").setCta().onClick(() => this.submit());
			})
			.addButton(b => b.setButtonText("Cancel").onClick(() => this.close()));

		refresh();
		// Defer focus one tick so the input is attached before we focus it. The
		// handle is held so onClose can cancel a still-pending timer, which also
		// keeps test runners from waiting on a stray handle.
		this.focusTimer = window.setTimeout(() => {
			this.focusTimer = null;
			input.focus();
		}, 0);
	}

	onClose(): void {
		if (this.focusTimer !== null) {
			window.clearTimeout(this.focusTimer);
			this.focusTimer = null;
		}
		this.contentEl.empty();
		// Dismissed without submitting: settle null so awaiting callers resume.
		this.settle(null);
	}
}
