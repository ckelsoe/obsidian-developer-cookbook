// Comprehensive color picker for Obsidian plugins.
//
// Part of a reusable component library for Obsidian plugins. Combines three ways to
// choose a color into one control:
//   1. Preset swatches    a row of theme-adaptive Obsidian colors, or a custom
//                         palette you supply.
//   2. Type-in hex field  paste or type "#e93147" (3- or 6-digit, hash optional).
//   3. Native picker chip  opens the operating system color picker (its built-in
//                         wheel / spectrum), via a standard <input type="color">.
//                         This is a Chromium element, so it works on Windows,
//                         macOS, and Linux with no platform-specific code.
//
// To use: copy this file into your plugin's source folder and paste
// color-picker.css into your styles.css.
//
// Dependencies: none. Uses only DOM APIs and Obsidian's global HTMLElement
// helpers (createDiv / createEl / addClass), so there is no import to satisfy.
//
//   createColorPicker(containerEl, {
//     current: this.settings.markerColor,         // "var(--color-red)" or "#e93147"
//     onChange: async value => {
//       this.settings.markerColor = value;        // value is undefined if reset
//       await this.plugin.saveData(this.settings);
//     },
//   });
//
// Value contract: a preset theme swatch emits its var() string (for example
// "var(--color-red)") so the stored color stays theme-adaptive across light and
// dark mode. The hex field and the native picker emit a literal "#rrggbb". Reset
// emits undefined. A consumer must therefore handle a value that is either a
// var() string or a hex string. Apply it with `el.style.color = value` (the
// browser resolves both forms) and persist it verbatim.
//
// CSS namespace: dcb- (safe to leave as-is; two plugins never share a DOM, so
// the prefix cannot collide). Rename via find-replace if you prefer your own.

// The 8 Obsidian theme color CSS variables. Theme-adaptive: their resolved hex
// values shift with the user's accent palette and light/dark mode, which is why
// the presets are kept as var() strings rather than baked-in hex.
const THEME_COLOR_VARS = [
	"--color-red",
	"--color-orange",
	"--color-yellow",
	"--color-green",
	"--color-cyan",
	"--color-blue",
	"--color-purple",
	"--color-pink",
] as const;

const DEFAULT_SWATCHES: string[] = THEME_COLOR_VARS.map(v => `var(${v})`);

export interface ColorPickerOptions {
	// Current value: a theme var string ("var(--color-red)"), a literal hex
	// ("#e93147"), or undefined for no color chosen.
	current?: string;
	// Called with the chosen value: "var(--...)" for a theme swatch, "#rrggbb"
	// for the hex field or native picker, or undefined when the user resets.
	onChange: (next: string | undefined) => void | Promise<void>;
	// Override the preset swatches. Each entry is any CSS color string: use
	// "var(--color-red)" to stay theme-adaptive, or a literal "#rrggbb" for a
	// fixed brand color. Omit to use the 8 Obsidian theme colors.
	swatches?: string[];
	// Show the type-in hex field. Defaults to true. Set false for a swatches +
	// native-chip only control.
	hexField?: boolean;
}

// Convert "rgb(R, G, B)" or "rgba(R, G, B, A)" (whatever getComputedStyle
// normalizes a CSS color to) into a 6-digit hex string the native
// <input type="color"> accepts. Returns undefined when the input is not a
// parseable rgb/rgba string (for example "transparent" or "" from a hidden
// element) so callers can skip the assignment rather than seeding black.
export function rgbStringToHex(rgb: string): string | undefined {
	const m = rgb.match(/\d+(?:\.\d+)?/g);
	if (!m || m.length < 3) return undefined;
	const [r, g, b] = m;
	const toHex = (raw: string | undefined): string => {
		const n = Math.max(0, Math.min(255, Math.round(parseFloat(raw ?? "0"))));
		return n.toString(16).padStart(2, "0");
	};
	return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Normalize a user-typed hex value to "#rrggbb" lowercase. Accepts an optional
// leading "#", and both 3-digit shorthand ("#abc" -> "#aabbcc") and 6-digit
// forms. Returns undefined for anything that is not a valid hex color, so the
// field can flag it without emitting a bad value.
export function normalizeHex(input: string): string | undefined {
	let s = input.trim().toLowerCase();
	if (s.startsWith("#")) s = s.slice(1);
	if (/^[0-9a-f]{3}$/.test(s)) {
		s = s.split("").map(c => c + c).join("");
	}
	if (/^[0-9a-f]{6}$/.test(s)) return `#${s}`;
	return undefined;
}

// Render the color picker into `parent`. Returns the wrapper element.
export function createColorPicker(parent: HTMLElement, opts: ColorPickerOptions): HTMLDivElement {
	const swatchValues = opts.swatches ?? DEFAULT_SWATCHES;
	const showHexField = opts.hexField !== false;

	const wrap = parent.createDiv({ cls: "dcb-color-picker" });

	// Preset swatches row.
	const presetRow = wrap.createDiv({ cls: "dcb-color-row" });
	presetRow.createDiv({ cls: "dcb-color-row-caption", text: "Presets" });
	const swatchRow = presetRow.createDiv({ cls: "dcb-color-swatches" });

	// Custom row: native picker chip, optional hex field, reset.
	const customRow = wrap.createDiv({ cls: "dcb-color-row" });
	customRow.createDiv({ cls: "dcb-color-row-caption", text: "Custom" });
	const customGroup = customRow.createDiv({ cls: "dcb-color-custom" });

	const chip = customGroup.createDiv({
		cls: "dcb-color-custom-chip",
		attr: { "aria-label": "Pick a custom color" },
	});
	const native = chip.createEl("input", {
		cls: "dcb-color-native",
		attr: { type: "color", "aria-label": "Pick a custom color" },
	});

	let hexInput: HTMLInputElement | null = null;
	if (showHexField) {
		hexInput = customGroup.createEl("input", {
			cls: "dcb-color-hex",
			attr: { type: "text", placeholder: "#rrggbb", "aria-label": "Hex color code", spellcheck: "false" },
		});
	}

	// --- Shared presentation helpers ------------------------------------

	const clearSwatches = (): void => {
		for (const s of Array.from(swatchRow.children)) s.removeClass?.("is-active");
	};

	// Reflect a concrete hex into the chip and the hex field without firing
	// events. Used by the native input, the hex field, and initial seeding.
	const showCustomHex = (hex: string): void => {
		native.value = hex;
		chip.style.backgroundColor = hex;
		chip.addClass("has-value");
		if (hexInput && hexInput.value.toLowerCase() !== hex) hexInput.value = hex;
		hexInput?.removeClass("is-invalid");
	};

	const clearChip = (): void => {
		chip.style.removeProperty("background-color");
		chip.removeClass("has-value");
		if (hexInput) {
			hexInput.value = "";
			hexInput.removeClass("is-invalid");
		}
	};

	// Update the native input's value silently (no 'input' event) so the OS
	// picker opens on this color, ready to nudge into a variation. Used when a
	// theme swatch is the active selection.
	const seedFromSwatch = (swatch: HTMLElement): void => {
		const hex = rgbStringToHex(getComputedStyle(swatch).backgroundColor);
		if (hex !== undefined) native.value = hex;
	};

	// --- Preset swatches -------------------------------------------------

	let activeSwatch: HTMLElement | null = null;

	for (const value of swatchValues) {
		const swatch = swatchRow.createEl("button", {
			cls: "dcb-color-swatch",
			attr: { type: "button", "aria-label": `Set color to ${value}` },
		});
		// Assign the background-color directly rather than via a custom property:
		// chained var() resolution inside an inline style rendered empty in some
		// Obsidian contexts, so a direct assignment is more reliable.
		swatch.style.backgroundColor = value;
		if (opts.current === value) {
			swatch.addClass("is-active");
			activeSwatch = swatch;
		}
		swatch.addEventListener("click", () => {
			void opts.onChange(value);
			clearSwatches();
			swatch.addClass("is-active");
			clearChip();
			seedFromSwatch(swatch);
		});
	}

	// --- Native picker ---------------------------------------------------

	native.addEventListener("input", () => {
		void opts.onChange(native.value);
		showCustomHex(native.value);
		clearSwatches();
	});

	// --- Hex field -------------------------------------------------------

	hexInput?.addEventListener("input", () => {
		const raw = hexInput.value;
		if (raw.trim() === "") {
			hexInput.removeClass("is-invalid");
			return;
		}
		const hex = normalizeHex(raw);
		if (hex === undefined) {
			// Flag without emitting: a half-typed "#e9" should not clobber state.
			hexInput.addClass("is-invalid");
			return;
		}
		hexInput.removeClass("is-invalid");
		void opts.onChange(hex);
		native.value = hex;
		chip.style.backgroundColor = hex;
		chip.addClass("has-value");
		clearSwatches();
	});

	// --- Reset -----------------------------------------------------------

	const resetBtn = customGroup.createEl("button", {
		cls: "dcb-color-reset",
		text: "Reset",
		attr: { type: "button" },
	});
	resetBtn.addEventListener("click", () => {
		void opts.onChange(undefined);
		clearChip();
		clearSwatches();
	});

	// --- Initial state ---------------------------------------------------

	if (activeSwatch) {
		// A preset is selected. Seed the native picker from its resolved color so
		// opening the OS picker starts on that color. Deferred one frame so the
		// swatch is attached before getComputedStyle is read.
		const swatch = activeSwatch;
		window.requestAnimationFrame(() => seedFromSwatch(swatch));
	} else if (opts.current) {
		const hex = normalizeHex(opts.current);
		if (hex !== undefined) showCustomHex(hex);
	}

	return wrap;
}
