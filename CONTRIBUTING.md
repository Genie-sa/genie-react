# Contributing

`pnpm check` runs lint, type checks, the build, release checks, tests and the docs checks. Run it before opening a pull request. `pnpm check:apps-e2e` runs every demo app against the built CLI and runtime, as CI does.

## Type checking

`pnpm typecheck` type-checks the packages and `evals` with [tsrs](https://github.com/oxc-project/tsrs), a Rust port of the TypeScript 7 compiler, at the version pinned in the root `package.json`. The docs and the Expo example use it too: `pnpm --filter @genie-react/docs typecheck`, and `pnpm --filter @genie-react/expo-demo typecheck` after `pnpm build`, because Expo reads the built types. TypeScript still generates the published `.d.ts` files, and `pnpm check:compatibility` type-checks an installed consumer with TypeScript 6 and 7.

Your editor keeps using the workspace TypeScript. To try the tsrs language server in VS Code, install the TypeScript 7 extension (`TypeScriptTeam.native-preview`) and add this to `.vscode/settings.json`, which git ignores:

```jsonc
{
  "js/ts.experimental.useTsgo": true,
  "js/ts.tsdk.path": "./node_modules/tsrs/tsdk"
}
```

## Changesets

A change to `genie-react` or `@genie-react/cli` that users can notice needs a changeset: run `pnpm changeset`. The two packages always release together at the same version.
