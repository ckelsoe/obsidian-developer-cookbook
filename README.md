# Developer Cookbook

Reusable code for building Obsidian plugins. Browse, copy what you need, ship it.

**Everything here is free to use** under the MIT license, in personal or commercial
plugins, with no attribution required. **Contributions are welcome**: if you have
built a reusable piece, add it following the conventions in `CONTRIBUTING.md` so the
collection stays consistent for everyone. This is a shared, community resource, not
a one-person library.

This is a **cookbook**, not a dependency. There is no package to install and no
version to track. You copy a piece of source into your own plugin and own it from
there. Two kinds of content:

- **Components** (`components/`) are self-contained code modules you copy in and
  use as a black box: a modal shell, an icon picker, a color picker, a declarative
  form builder. You pass them configuration; you do not edit their internals.
- **Examples** (`examples/`) are documented patterns you read and adapt to your own
  conventions. The value is the approach, not avoiding a few lines of typing.

The repository is itself a small Obsidian plugin (the files at the root) that
renders every component live, so you can see each one work before you copy it.

## Using a component in your plugin

1. Open the component's folder under `components/` and read the header comment in
   its main `.ts` file. That documents the API.
2. Copy the `.ts` file (or files, some components are split) into your plugin's
   source.
3. Copy the matching `.css` block into your plugin's `styles.css`.
4. Import and call.

That is the whole workflow. Each component imports only from `obsidian` (and its
own sibling files), takes plain values and callbacks, and ships scorecard-clean
code, so it drops into any plugin without dragging dependencies along.

## Layout

```
components/      copy-in code modules (each: .ts + .css, sometimes split)
examples/        read-and-adapt patterns
main.ts          the demo plugin entry point (imports + showcases every component)
manifest.json    the demo plugin lives at the repo root so BRAT can install it
styles.css       assembled from the component CSS blocks
```

See `components/README.md` for the component inventory and the self-contained
contract, and `examples/README.md` for the component-vs-example test.

## The CSS prefix

Every component's CSS is namespaced with the `dcb-` prefix so it cannot collide
with your plugin's own styles or Obsidian's. Leave it as-is (two plugins never
share a document, so it is always safe), or find-replace it to your own prefix if
you prefer. It is never required for correctness.

## Compatibility

Components target Obsidian **1.13+** unless their header says otherwise. Where a
component uses a 1.13-only API, that is noted in its file.

## Trying the demo plugin

The demo is distributed through [BRAT](https://github.com/TfTHacker/obsidian42-brat)
only; it is not in the community plugin store. Install BRAT, choose "Add beta
plugin," and point it at `ckelsoe/obsidian-developer-cookbook`. Then run any of its
commands (for example "Show component gallery" or "Build a code block from a form")
to see the components in action over a note. To hack on it locally instead, run
`npm install` then `npm run build`, and load the folder as an unpacked plugin.

## Contributing

This is meant to grow with community contributions. See `CONTRIBUTING.md` for the
conventions that keep every component copy-in-able and consistent (the
self-contained contract, the `dcb-` prefix, the inventory, wiring into the demo) and
the checklist for adding one. Following them is what keeps the collection from
becoming a mess as more people add to it.
