# Examples

Documented UI patterns for Obsidian plugins. Unlike the drop-in components in
`../components/`, an example is something you **read, understand, and adapt**, not
a file you copy unread. The reusable thing here is the judgment (when and why to
use the pattern), and the code is short enough that you retype or paste it into
your own conventions.

## Component or example?

Use this test when deciding where a piece of UI work belongs:

- **Component** (`../components/`): would a developer copy the file and trust it
  without reading every line? Is the value in *not having to rewrite tedious or
  tricky code* (virtualization, hex parsing, a Promise-settled modal)? Then it is
  a component. Components bake the `dcb-` CSS prefix because you do not touch them.
- **Example** (here): is the code nearly trivial, with the real value being *the
  approach and when to reach for it*? Would a developer want to adapt it to their
  own naming and styling rather than import it as-is? Then it is an example.
  Examples use *your plugin's* CSS prefix, because adapting them to your
  conventions is the point.

A twelve-line div helper is an example. A 130-line virtualized grid is a component.
When in doubt, ask whether you are saving someone *typing* (example) or saving
them *getting something hard right* (component).

## Inventory

| Example | File | The pattern |
|---|---|---|
| Stacked row | `stacked-row.md` | Label and description on top, full-width control below, for long settings controls that Obsidian's right-rail `Setting` would squeeze in a narrow panel |
