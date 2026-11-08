# Changelog

## 0.1.2 (2026-11-08)

- Grammar refresh against the spec and a tree-sitter grammar corpus (tree-sitter-xo): `derive` on the line after a
  type's closing brace, `bound` after a loop header (`for x in xs bound N`, `while c bound N`), `result` inside
  `ensures`, `realtime` in a `uses` clause, and the `Task`, `Scope` and `Effects` types now highlight.
- Destructuring assignment (tuple, list and struct targets), struct literal defaults, match guards and the other newer
  forms were checked and need no change.
- Grammar tests: `test/contextual.xo` asserts the scopes of the contextual words, and `test/snap/` holds snapshot
  tests (`npm test` runs them) over every form of the tree-sitter-xo corpus and a file of the newer forms, so a
  grammar change that moves a scope shows up as a snapshot diff (`npx vscode-tmgrammar-snap -u` accepts it).

## 0.1.1 (2026-11-05)

- An icon (Finan, Xo's fox) and a dark banner on the Marketplace and Open VSX pages.

## 0.1.0 (2026-11-05)

- The extension has its own repository, xo-lang/vscode, with the history
  of `editors/vscode` in the Xo repository.
- Debugging: a debug type `xo` runs `xo debug --dap` (Xo's own debugger:
  breakpoints, stepping, the stack, locals, threads, tasks), with launch
  (an executable built with its debug information, or a `.xo` file or a
  package directory, built with `xo build` first) and attach (a process
  id and its executable). F5 on an open `.xo` file debugs its package.
  Debugging needs Xo 0.40 or later (`xo debug --dap`); with an older xo
  a debug session does not start and says which xo it found.
- The `xo` binary is the `xo.path` setting, then `xo` on PATH, then
  `bin/xo` of an Xo checkout or `.tools/bin/xo` in a workspace folder or
  above it (the checkout came first before).
- `npm run check:grammar` compares the grammar's keywords with the newest
  Xo release's lexer (or a local `token.xo` with `--lexer`); it replaces
  the Go test that read the lexer from the Xo checkout.

## 0.0.1

- Syntax highlighting (a TextMate grammar, and `xo` fences in Markdown),
  and `xo lsp` for diagnostics, quick fixes, hover, definition,
  references, rename, symbols, semantic highlighting and formatting.
