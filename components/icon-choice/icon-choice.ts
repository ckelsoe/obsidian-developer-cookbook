// Curated icon picker for Obsidian plugins.
//
// Part of a reusable component library for Obsidian plugins. Unlike the full
// browse-all icon picker, this control shows only the icons you hand it: pass an
// array of icon ids and the user picks one, like a radio group rendered as icon
// buttons. Use it when a setting should offer a small, deliberate set of choices
// (a ribbon icon, a marker style) rather than the entire icon set.
//
// To use: copy this file into your plugin's source folder and paste
// icon-choice.css into your styles.css.
//
// Dependencies: the `obsidian` package only (just setIcon). No app instance, no
// modal, no plugin types.
//
//   createIconChoice(containerEl, {
//     icons: ["pencil", "highlighter", "message-square", "bookmark"],
//     current: this.settings.markerIcon,
//     onChange: async id => {
//       this.settings.markerIcon = id;
//       await this.plugin.saveData(this.settings);
//     },
//   });
//
// CSS namespace: dcb- (safe to leave as-is; two plugins never share a DOM, so
// the prefix cannot collide). Rename via find-replace if you prefer your own.

import { setIcon } from "obsidian";

export interface IconChoiceOptions {
	// The icon ids to offer. Any id valid for setIcon works (Lucide / Obsidian
	// icons, plus anything registered via addIcon).
	icons: string[];
	// The currently selected id, if any. Its button starts active.
	current?: string;
	// Called with the picked id when the user selects one, or undefined when
	// they clear the selection (only reachable when allowClear is true).
	onChange: (next: string | undefined) => void | Promise<void>;
	// Show a "Clear" button that deselects. Off by default: most settings want a
	// value to always be chosen.
	allowClear?: boolean;
}

// Render a single-select row of icon buttons into `parent`. Returns the wrapper
// element so the caller can position or further style it.
export function createIconChoice(parent: HTMLElement, opts: IconChoiceOptions): HTMLDivElement {
	const wrap = parent.createDiv({ cls: "dcb-icon-choice" });
	const buttons = new Map<string, HTMLElement>();

	// Single-select: clear every button's active state, then mark the chosen
	// one. Kept in a Map so re-selecting is a lookup, not a DOM re-render.
	const setActive = (id: string | undefined): void => {
		for (const [iconId, btn] of buttons) {
			btn.toggleClass("is-active", iconId === id);
		}
	};

	for (const id of opts.icons) {
		const btn = wrap.createEl("button", {
			cls: "dcb-icon-choice-btn",
			attr: { type: "button", title: id, "aria-label": id },
		});
		const glyph = btn.createSpan({ cls: "dcb-icon-choice-glyph" });
		setIcon(glyph, id);
		if (id === opts.current) btn.addClass("is-active");
		btn.addEventListener("click", () => {
			setActive(id);
			void opts.onChange(id);
		});
		buttons.set(id, btn);
	}

	if (opts.allowClear) {
		const clear = wrap.createEl("button", {
			cls: "dcb-icon-choice-clear",
			text: "Clear",
			attr: { type: "button" },
		});
		clear.addEventListener("click", () => {
			setActive(undefined);
			void opts.onChange(undefined);
		});
	}

	return wrap;
}
