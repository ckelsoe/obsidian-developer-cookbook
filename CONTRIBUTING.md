# Contributing

Thanks for adding to the cookbook. The single rule that matters: a component must
stay **copy-in-able**, droppable into any plugin without dragging dependencies
along. Everything below serves that.

## The self-contained contract

A component must:

1. **Import only from `obsidian`** and from sibling files inside its own component
   folder. Never from a host plugin's domain modules, settings, or types.
2. **Take plain values and callbacks**, never a plugin instance. Persistence is the
   caller's job: hand the chosen value back via a callback or a resolved Promise.
3. **Ship its own CSS** as a `.css` file beside the `.ts`, namespaced with the
   `dcb-` prefix. Never inject a `<style>` element at runtime (the developer-portal
   scorecard's `no-static-styles` rule forbids it).
4. **Be scorecard-clean**: sentence-case UI strings, `createDiv` / `createSpan` over
   `createEl('div')`, no inline `style` attributes, no `!important` in CSS, every
   timer owned and cleared in a cleanup path.

If a piece of work is nearly trivial and its value is the approach rather than the
code, it belongs in `examples/` as a documented pattern, not in `components/`. The
test: are you saving someone tedious-or-tricky code (component), or saving them
typing (example)?

## Adding a component

1. Create `components/<name>/` with `<name>.ts` and `<name>.css`. Split into extra
   `.ts` files in the same folder if the logic benefits (pure helpers, etc.).
2. Open the `.ts` with a header comment that documents: what it is, when to use it,
   how to use it (a short snippet), its dependencies, and which files to copy.
3. Use the `dcb-` CSS prefix for every class.
4. Add a row to the inventory table in `components/README.md`.
5. Wire it into the `demo/` plugin so it is exercised and shown. This is also how
   the component gets compiled against real Obsidian types.
6. Run the demo's `npm run lint && npm run build` and confirm both pass.

## Adding an example

1. Create `examples/<name>.md` with: the problem it solves, the code, the paired
   CSS, a usage snippet, and notes on when to use it.
2. Present the code with a generic prefix (for example `myplugin-`) and tell the
   reader to use their own, since examples are adapted, not copied verbatim.
3. Add a row to the inventory in `examples/README.md`.

## Keeping copies honest

The source here is canonical. If you fix a real bug in a copy living inside some
plugin, port the fix back here, then decide whether other copies need it too.
