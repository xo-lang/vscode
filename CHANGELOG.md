# Changelog

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
