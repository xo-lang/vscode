# Releasing

A release publishes the extension to the Visual Studio Marketplace
(`xo-lang.xo`), Open VSX, and a GitHub release with the `.vsix`
attached. Pushing a tag `vX.Y.Z` runs `.github/workflows/release.yml`,
which does all three from one packaged `.vsix`.

## Steps

1. Bump the version in `package.json` (and `package-lock.json`):

   ```sh
   npm version 0.1.1 --no-git-tag-version
   ```

2. In `CHANGELOG.md`, add a section `## 0.1.1 (YYYY-MM-DD)` at the top
   with what changed. The section's text becomes the GitHub release's
   notes.

3. Check locally (the same checks the workflow runs first):

   ```sh
   node scripts/release-check.js v0.1.1
   npm test
   npm run check:grammar
   npx vsce package
   ```

   `release-check.js` fails when the tag is not `v` plus the
   `package.json` version, or when the changelog has no section for it
   (or one still marked unreleased).

4. Commit, tag, and push the commit and then the tag:

   ```sh
   git commit -am "Release 0.1.1"
   git tag v0.1.1
   git push origin main
   git push origin v0.1.1
   ```

5. Watch the run: `gh run watch --repo xo-lang/vscode` (or the Actions
   tab). When it ends, check the
   [Marketplace page](https://marketplace.visualstudio.com/items?itemName=xo-lang.xo),
   [Open VSX](https://open-vsx.org/extension/xo-lang/xo), and the
   GitHub release.

A version can be published only once to each registry, and both publish
steps pass `--skip-duplicate`. If a run fails partway (for example the
Marketplace published and Open VSX refused the token), fix the cause and
publish the tag again with the current workflow file:

    gh workflow run release.yml --repo xo-lang/vscode -f tag=vX.Y.Z
    gh run watch --repo xo-lang/vscode

It checks out the tag, builds the same package, skips each registry that
already has the version, and creates the GitHub release only if it is
missing. (`gh run rerun` would use the workflow file at the tag's commit,
which for tags before 2026-11-05's fix stops at the step that already
published.) v0.1.1 was finished this way on 2026-11-05 after Open VSX
refused the first OVSX_PAT.

## Secrets

The repository's Actions secrets:

- `VSCE_PAT`: an Azure DevOps personal access token for the `xo-lang`
  Marketplace publisher, with the **Marketplace (Manage)** scope and
  **All accessible organizations**. Azure DevOps tokens last at most one
  year: renew it before it expires (create a new token at
  dev.azure.com under User settings, Personal access tokens, then
  replace the secret with `gh secret set VSCE_PAT --repo
  xo-lang/vscode`). A release run that fails at "Publish to the Visual
  Studio Marketplace" with a 401 usually means the token expired.
- `OVSX_PAT`: an Open VSX access token (open-vsx.org, Settings, Access
  Tokens) for an account that is a member of the `xo-lang` namespace.
  Replace it the same way with `gh secret set OVSX_PAT`.

The GitHub release uses the workflow's own `GITHUB_TOKEN` (the workflow
has `contents: write` and nothing else).
