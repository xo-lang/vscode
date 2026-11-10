# Xo for Visual Studio Code

Language support for [Xo](https://github.com/xo-lang/xo): syntax
highlighting, the `xo lsp` language server, and Xo's own debugger
through `xo debug --dap`.

## Features

- Highlighting of `.xo` files and of `xo` fences in Markdown.
- `xo lsp`: diagnostics and quick fixes, hover, go to definition,
  references, rename, document symbols, semantic highlighting and
  formatting.
- Debugging (debug type `xo`): breakpoints, step in, over and out, the
  call stack, locals, threads and the program's tasks, on macOS arm64,
  Linux and Windows. Press F5 in an open `.xo` file to build its package
  and debug it, or add a configuration:

  ```json
  {
    "type": "xo",
    "request": "launch",
    "name": "Xo: debug the package",
    "program": "${workspaceFolder}",
    "args": [],
    "cwd": "${workspaceFolder}"
  }
  ```

  `program` is an executable built with its debug information (a plain
  `xo build` keeps it) or Xo source: a `.xo` file or a package directory,
  which the extension builds with `xo build` first. An attach takes
  `processId` (asked for when empty) and `program`, the process's
  executable; ending the session detaches and leaves the program running.

## Requirements

An `xo` with `xo lsp`. Debugging needs Xo 0.40 or later (`xo debug
--dap`); with an older xo the extension says so when a debug session
starts, and highlighting and `xo lsp` still work. The extension
uses, in order: the `xo.path` setting, `xo` on PATH, then `bin/xo` of an
Xo checkout or `.tools/bin/xo` in a workspace folder or a directory above
it.

The Xo output channel names the xo it chose, its version and where it
came from. The extension tells you when there is no xo (with a button to
set `xo.path` and a link to the install docs), when the xo is older than
0.44.0 or than the first xo that reads the project's `edition` line, and,
once per binary, when it fell back to a `bin/xo` or `.tools/bin/xo` in
the workspace because there is no xo on PATH. After changing PATH,
restart VS Code (a running VS Code keeps the PATH it started with), or
set `xo.path`.

## Settings

| Setting | Default | Meaning |
|---|---|---|
| `xo.path` | `""` | The xo binary; empty: found as above. |
| `xo.lsp.enabled` | `true` | Start `xo lsp`. |
| `xo.hover.docLinks` | `true` | End a std declaration's hover with a link to its std reference page on xolang.dev. |

The command "Xo: Restart Language Server" restarts `xo lsp` (after a new
xo, say). The "Xo" output channel shows which xo answers.

## Development

```
npm ci
npm test                  # unit tests and the grammar's tokenization tests
XO_TEST_XO=$(which xo) npm test   # also debugs a program through xo debug --dap
npm run check:grammar     # the grammar's keywords against the newest Xo release's lexer
npm run check:grammar -- --lexer ../xo/compiler/lexer/token.xo   # against a checkout
npx @vscode/vsce package  # xo-0.1.0.vsix
code --install-extension xo-0.1.0.vsix
```

When Xo's lexical structure changes (a keyword, a literal form, a
contextual word), update `syntaxes/xo.tmLanguage.json` and
`test/syntax.xo`; `check:grammar` fails until the keywords agree with the
release that has the change.

## License

MIT, as Xo.
