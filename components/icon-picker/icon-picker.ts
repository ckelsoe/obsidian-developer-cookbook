// Browse-all icon picker for Obsidian plugins.
//
// Part of a reusable component library for Obsidian plugins. This is the full-set
// counterpart to icon-choice: the user searches and browses every registered
// icon (the full Lucide / Obsidian set plus any addIcon registrations) in a
// virtualized grid, so the list stays fast no matter how large. Use it when the
// user should be free to pick any icon, not a curated few.
//
// To use: copy all four .ts files in this folder into your plugin's source
// (icon-picker.ts, virtual-list.ts, virtual-window.ts, icon-collect.ts) and
// paste icon-picker.css into your styles.css.
//
// Dependencies: the `obsidian` package, plus the three sibling files in this
// folder. No plugin instance or domain types.
//
// Inline trigger (a button that shows the current icon and opens the picker):
//
//   createIconPicker(containerEl, {
//     app: this.app,
//     current: this.settings.ribbonIcon,
//     onChange: async id => {
//       this.settings.ribbonIcon = id;            // id is undefined if cleared
//       await this.plugin.saveData(this.settings);
//     },
//   });
//
// Or open the modal directly (for example from a command), skipping the trigger:
//
//   new SelectIconModal(this.app, current, id => { /* use id */ }).open();
//
// CSS namespace: dcb- (safe to leave as-is; two plugins never share a DOM, so
// the prefix cannot collide). Rename via find-replace if you prefer your own.

import { App, Modal, SearchComponent, getIconIds, setIcon } from "obsidian";
import { createVirtualList, type VirtualListController } from "./virtual-list";
import { filterIcons, sortIcons } from "./icon-collect";

export interface IconPickerOptions {
	app: App;
	current?: string;
	// Called with the chosen icon id, or undefined when the user clears it.
	onChange: (next: string | undefined) => void | Promise<void>;
}

// Render an inline icon-picker control: a square trigger showing the current
// icon (its id in the tooltip and aria-label), plus a Clear button once an icon
// is set. Clicking the trigger opens the browse-all modal. Returns the wrapper.
export function createIconPicker(parent: HTMLElement, opts: IconPickerOptions): HTMLDivElement {
	const wrap = parent.createDiv({ cls: "dcb-icon-picker" });

	const renderTrigger = (iconId: string | undefined): void => {
		wrap.empty();
		const tooltip = iconId ? `Icon: ${iconId}` : "Pick an icon";
		const trigger = wrap.createEl("button", {
			cls: "dcb-icon-picker-trigger",
			attr: { type: "button", title: tooltip, "aria-label": tooltip },
		});
		const preview = trigger.createSpan({ cls: "dcb-icon-picker-preview" });
		if (iconId) {
			setIcon(preview, iconId);
		} else {
			preview.setText("?");
			preview.addClass("is-empty");
		}
		trigger.addEventListener("click", () => {
			new SelectIconModal(opts.app, iconId ?? "", async next => {
				await opts.onChange(next);
				renderTrigger(next);
			}).open();
		});

		// Inline clear button so the user can reset to no icon.
		if (iconId) {
			const clear = wrap.createEl("button", {
				cls: "dcb-icon-picker-clear",
				text: "Clear",
				attr: { type: "button" },
			});
			clear.addEventListener("click", () => {
				void opts.onChange(undefined);
				renderTrigger(undefined);
			});
		}
	};

	renderTrigger(opts.current);
	return wrap;
}

// Fixed grid-row height for the virtual list (preview glyph plus a two-line
// clamped id label). Each virtual row holds `columns` cells.
const ROW_HEIGHT = 88;

// Approximate cell footprint (min cell width plus gap). Columns is derived from
// the container width divided by this, so the grid reflows as the modal resizes.
const CELL_FOOTPRINT = 100;

// Browse and pick any Lucide / Obsidian icon id usable in setIcon and
// addRibbonIcon. getIconIds() and setIcon() are public obsidian exports. The
// grid is virtualized as rows of `columns` cells, so the full icon set scrolls
// smoothly without a render cap. Clicking a cell calls onChoose(id) and closes.
export class SelectIconModal extends Modal {
	private allIds: string[];
	private current: string;
	private onChoose: (id: string) => void;
	private listEl!: HTMLElement;
	private countEl!: HTMLElement;
	private matches: string[] = [];
	private columns = 6;
	private vlist: VirtualListController | null = null;
	private resizeObserver: ResizeObserver | null = null;

	constructor(app: App, current: string, onChoose: (id: string) => void) {
		super(app);
		this.current = current;
		this.onChoose = onChoose;
		// Enumerate live and sort once. Never hardcode: the set is runtime
		// dependent (core icons plus any addIcon registrations from other plugins).
		this.allIds = sortIcons(getIconIds());
	}

	onOpen(): void {
		this.modalEl.addClass("dcb-icon-dialog");
		this.titleEl.setText("Choose an icon");

		const { contentEl } = this;
		contentEl.empty();

		const search = new SearchComponent(contentEl);
		search.setPlaceholder("Search icons by ID");
		search.inputEl.addClass("dcb-icon-search");
		search.onChange(value => this.renderList(value));

		this.countEl = contentEl.createDiv({ cls: "dcb-icon-count" });
		this.listEl = contentEl.createDiv({ cls: "dcb-icon-grid" });

		this.vlist = createVirtualList({
			scrollEl: this.listEl,
			rowHeight: ROW_HEIGHT,
			renderRow: (index, rowEl) => this.renderRow(index, rowEl),
		});

		// Recompute columns and row count whenever the grid's width changes (modal
		// resize, window resize). Observing also fires once with the initial size,
		// which corrects the column count after first layout.
		this.resizeObserver = new ResizeObserver(() => this.relayout());
		this.resizeObserver.observe(this.listEl);

		this.renderList("");
	}

	onClose(): void {
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
		this.vlist?.destroy();
		this.vlist = null;
		this.contentEl.empty();
	}

	private renderList(query: string): void {
		this.matches = filterIcons(this.allIds, query);
		this.countEl.setText(`${this.matches.length} icons`);
		this.relayout();
	}

	// Map the current match count onto grid rows for the active column count.
	private relayout(): void {
		this.columns = this.computeColumns();
		const rowCount = Math.ceil(this.matches.length / this.columns);
		this.vlist?.setRowCount(rowCount);
	}

	private computeColumns(): number {
		const width = this.listEl?.clientWidth ?? 0;
		// Before first layout the width is 0; keep the last known column count so
		// the grid is not briefly single-column. The ResizeObserver corrects it.
		if (width <= 0) return this.columns;
		return Math.max(1, Math.floor(width / CELL_FOOTPRINT));
	}

	private renderRow(rowIndex: number, rowEl: HTMLElement): void {
		rowEl.addClass("dcb-icon-row");
		const start = rowIndex * this.columns;
		for (let c = 0; c < this.columns; c++) {
			const idx = start + c;
			if (idx >= this.matches.length) {
				// Pad the trailing slots so the real cells keep their width.
				rowEl.createDiv({ cls: "dcb-icon-cell-spacer" });
				continue;
			}
			const id = this.matches[idx];
			if (id === undefined) continue;
			const cell = rowEl.createDiv({
				cls: "dcb-icon-cell",
				attr: { "aria-label": `Choose ${id}`, title: id },
			});
			if (id === this.current) {
				cell.addClass("is-selected");
			}
			const preview = cell.createDiv({ cls: "dcb-icon-preview" });
			setIcon(preview, id);
			cell.createSpan({ cls: "dcb-icon-label", text: id });
			cell.addEventListener("click", () => {
				this.onChoose(id);
				this.close();
			});
		}
	}
}
