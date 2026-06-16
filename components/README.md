# Component registry

Self-contained, drop-in code samples for Obsidian plugins. Pick the ones you
need, copy them into a plugin, and use them. No package to install, no version
to track, no build step beyond your plugin's existing one.

This is the registry model (think shadcn/ui, not a runtime library): each
component is source you own once it lands in your plugin. Fix it, restyle it,
delete the parts you do not use. The cost is that copies can drift from the
source here; see "Keeping copies in sync" below.

## The self-contained contract

Every component in this registry obeys these rules, which is what makes it
droppable into any plugin without untangling dependencies:

1. **Imports only from `obsidian`** (and sibling files inside the same component
   folder). Never from a plugin's domain modules, settings, or types. A modal that
   imports its own plugin's `./types`, `./categories`, and `./settings`, for example,
   cannot move to another plugin. A registry component takes plain values and
   callbacks instead.
2. **No plugin instance.** Components take `app: App` and primitive options, never
   `this.plugin`. Persistence is the caller's job: a component hands you the chosen
   value via callback or a resolved Promise, and you save it.
3. **Ships its own CSS** as a `.css` file beside the `.ts`. You paste that block
   into your plugin's `styles.css`. Components never inject a `<style>` element at
   runtime, because the developer-portal scorecard's `no-static-styles` rule
   forbids it.
4. **Scorecard-clean out of the box.** Sentence-case UI strings, `createDiv` /
   `createSpan` over `createEl('div')`, no inline `style` attributes, no `!important`
   in the CSS, every timer owned and cleared. Dropping a component in must never
   introduce a lint violation.

### CSS namespace

Every component uses the `dcb-` prefix (developer-cookbook). Leave it as-is: two
plugins never render into the same document, so the prefix cannot collide with
anything. Rename it with a find-replace only if you want the class names to match
your plugin's own prefix. It is never required for correctness.

## How to use a component

1. Copy the component's `.ts` file into your plugin's source folder.
2. Open the matching `.css` file and paste its contents into your `styles.css`.
3. Import and call. Each `.ts` file's header comment documents its API.

## Inventory

| Component | File | What it gives you |
|---|---|---|
| Modal dialogs | `modal-dialog/` | `ConfirmModal` (await a yes/no) and `PromptModal` (await a validated text entry), both Promise-based |
| Form modal | `form-modal/` | Three layers: `FormModal` (the render-callback shell), `openSchemaForm` (describe fields as data, rendered with native Obsidian `Setting` controls, with mandatory / skip / pattern validation), and `serializeCodeBlock` (turn the result into a `key:value` code block). Targets Obsidian 1.13+ |
| Curated icon picker | `icon-choice/` | `createIconChoice` renders a single-select row from a developer-supplied array of icon ids. Inline, no modal, imports only `setIcon`. Use it when a setting should offer a short, deliberate set of icons |
| Browse-all icon picker | `icon-picker/` | `createIconPicker` inline trigger plus the `SelectIconModal` it opens: a searchable, virtualized grid over every registered icon. Copy all four `.ts` files in the folder |
| Color picker | `color-picker/` | `createColorPicker`: preset swatches (theme-adaptive by default, or a custom palette), a type-in hex field, and a native OS picker chip. Emits `var(--...)` for theme swatches and `#rrggbb` otherwise. One file, no imports |

The `form-modal/` folder is layered so you copy only what you need: take
`form-modal.ts` + `.css` alone for the render-callback shell, add `schema-form.ts`
for declarative data-driven forms, and add `code-block.ts` if you are building a
code block from the result (the build-this-block-from-a-form use case). The
declarative layer drives Obsidian's native `Setting` controls rather than custom
DOM, which is the closest a custom modal can get to "directly in Obsidian": the
1.13 `getSettingDefinitions` auto-renderer is bound to settings tabs and pages and
cannot be mounted in a modal, but the `Setting` widget itself renders into any
element.

There are deliberately two icon components, because they answer to different
owners of the option set:

- **`icon-choice/`**: the *developer* fixes the choices. Inline row, curated
  array, no search. One file.
- **`icon-picker/`**: the *user* browses the full set. Modal with search and a
  virtualized grid for the whole icon list. Four files (`icon-picker.ts`,
  `virtual-list.ts`, `virtual-window.ts`, `icon-collect.ts`), because the
  virtualization is what keeps the full set fast and it is split into pure,
  testable pieces.

The registry is complete for now at the four components above. Smaller UI
patterns that are not worth shipping as drop-in components (the stacked-row
settings layout, for one) live as documented patterns in `../examples/`, which
you read and adapt rather than copy unread.

Deliberately deferred:

- **Advanced color wheel (`color-wheel/`).** A custom in-DOM HSV wheel that looks
  identical on every platform. Not built, because the `color-picker` native chip
  already opens a working wheel/spectrum on Windows, macOS, and Linux with no
  platform code, and a hand-built wheel is the heaviest possible component (pointer
  math, accessibility, cross-platform testing). Add it only when a real plugin needs
  pixel-consistent wheel chrome (for example a theme designer), not speculatively.

## Keeping copies in sync

Once you copy a component into a plugin, that copy can drift from the source here.
The rule: when you fix a real bug in a copy living inside a plugin, port the fix
back to the source in this folder, then decide whether other copies need it too.
The registry is the canonical version; a plugin's copy is a fork you chose to take.
