// Form modal shell for Obsidian plugins.
//
// Part of a reusable component library for Obsidian plugins. This is the general-case
// modal: you supply the body, it owns the chrome and lifecycle. Use it for any
// modal whose body is more than a message or a single field (a create/edit form,
// a multi-field dialog, anything that composes several controls).
//
// The shell provides the title, a scrollable body, a footer with a primary and a
// Cancel button, focus handling, Escape / click-out dismissal, and a Promise that
// resolves exactly once. You provide two functions:
//   - render(body, form): fill the body with your fields. Capture each field's
//     value in a closure variable. Use form.setSubmitEnabled(...) to gate the
//     primary button on your own validation.
//   - onSubmit(): run when the user submits. Read your captured values and save.
//     Return false to block closing (validation failed); return true or nothing
//     to accept and close.
//
// ask() resolves true if the user submitted, false if they cancelled or dismissed.
//
// To use: copy this file into your plugin's source folder and paste
// form-modal.css into your styles.css.
//
// Dependencies: the `obsidian` package only. Compose any registry component
// (color-picker, icon-picker, ...) inside render by importing it alongside this.
//
// CSS namespace: dcb- (safe to leave as-is).

import { App, ButtonComponent, Modal, Setting } from "obsidian";

export interface FormControls {
	// Enable or disable the primary (submit) button. Call from render as fields
	// change to gate submission on your validation.
	setSubmitEnabled(enabled: boolean): void;
	// Trigger submit programmatically (for example from an Enter key handler on a
	// field you rendered).
	submit(): void;
	// Close the modal as a cancel (ask() resolves false).
	cancel(): void;
}

export interface FormModalOptions {
	title: string;
	// Primary button label. Defaults to "Save".
	cta?: string;
	// Render the primary button in the destructive (red) style.
	destructive?: boolean;
	// Start with the primary button disabled until your validation enables it.
	submitDisabled?: boolean;
	// Build the body. `body` is a scrollable content div you populate; `form`
	// gates and triggers submission. Capture field values in closures and read
	// them in onSubmit.
	render: (body: HTMLElement, form: FormControls) => void;
	// Run when the user submits. Return false to keep the modal open (validation
	// failed); return true or nothing to accept and close. May be async.
	onSubmit: () => boolean | void | Promise<boolean | void>;
}

export class FormModal extends Modal {
	private readonly options: FormModalOptions;
	private settled = false;
	private resolve!: (submitted: boolean) => void;
	private submitBtn: ButtonComponent | null = null;
	private focusTimer: number | null = null;
	private submitting = false;

	constructor(app: App, options: FormModalOptions) {
		super(app);
		this.options = options;
	}

	// Open the modal and await the outcome: true if submitted, false otherwise.
	ask(): Promise<boolean> {
		return new Promise(resolve => {
			this.resolve = resolve;
			this.open();
		});
	}

	private settle(submitted: boolean): void {
		if (this.settled) return;
		this.settled = true;
		this.resolve(submitted);
	}

	private async handleSubmit(): Promise<void> {
		// Ignore re-entrant clicks while an async onSubmit is running.
		if (this.submitting) return;
		this.submitting = true;
		this.submitBtn?.setDisabled(true);
		try {
			const result = await this.options.onSubmit();
			if (result === false) {
				// Validation rejected the submit: stay open for another attempt.
				this.submitting = false;
				this.submitBtn?.setDisabled(false);
				return;
			}
			this.settle(true);
			this.close();
		} catch (err) {
			// Never close on an error. Surface it and let the user retry.
			console.error(err);
			this.submitting = false;
			this.submitBtn?.setDisabled(false);
		}
	}

	onOpen(): void {
		this.titleEl.setText(this.options.title);
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("dcb-form");

		const body = contentEl.createDiv({ cls: "dcb-form-body" });

		const form: FormControls = {
			setSubmitEnabled: (enabled: boolean) => this.submitBtn?.setDisabled(!enabled),
			submit: () => void this.handleSubmit(),
			cancel: () => this.close(),
		};

		this.options.render(body, form);

		new Setting(contentEl)
			.setClass("dcb-form-footer")
			.addButton(b => {
				this.submitBtn = b;
				b.setButtonText(this.options.cta ?? "Save").onClick(() => void this.handleSubmit());
				if (this.options.destructive) b.setDestructive();
				else b.setCta();
				if (this.options.submitDisabled) b.setDisabled(true);
			})
			.addButton(b => b.setButtonText("Cancel").onClick(() => this.close()));

		// Focus the first field so the form is keyboard-ready on open. Deferred a
		// tick so the body is attached; the handle is held so onClose can cancel a
		// still-pending timer.
		this.focusTimer = window.setTimeout(() => {
			this.focusTimer = null;
			const first = body.querySelector<HTMLElement>("input, textarea, select, button");
			first?.focus();
		}, 0);
	}

	onClose(): void {
		if (this.focusTimer !== null) {
			window.clearTimeout(this.focusTimer);
			this.focusTimer = null;
		}
		this.contentEl.empty();
		// Dismissed without a successful submit: settle false so awaiting callers
		// resume. The settle guard makes this a no-op after a real submit.
		this.settle(false);
	}
}
