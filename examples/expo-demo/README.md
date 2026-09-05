# Expo demo

This app verifies the `genie-react/native` integration in a real Expo and Metro project. It mounts
deterministic fixtures for React props, hooks, context, Suspense, error boundaries, effects,
profiling, TanStack Query, and a memory-history TanStack Router.

From the repository root, install dependencies:

```sh
pnpm install
```

In one terminal, start the Genie hub:

```sh
pnpm --filter @genie-react/expo-demo hub
```

In another terminal, start Expo Go:

```sh
pnpm --filter @genie-react/expo-demo start
```

The default hub address is `127.0.0.1` on iOS Simulator and `10.0.2.2` on Android
Emulator. The hub listens on the development machine's loopback interface. For a physical device,
first forward port `4390` to the hub, then set the forwarded address before starting Expo:

```sh
EXPO_PUBLIC_GENIE_URL=ws://<forwarded-host>:4390/__genie/ws \
  pnpm --filter @genie-react/expo-demo start
```

After the app opens, verify the connection and exercise the counter:

```sh
pnpm --filter @genie-react/expo-demo exec genie-react status
pnpm --filter @genie-react/expo-demo exec genie-react call \
  react_find_components '{"query":"App","exact":true}'
```

For a deterministic render-observation smoke test, start a fresh window with an explicit budget,
press **Increment** once, and capture the result:

```sh
pnpm --filter @genie-react/expo-demo exec genie-react call react_clear_renders \
  '{"budget":{"fiberLimit":12000,"operationLimit":900000,"timeLimitMs":200,"targetOperationReserve":300000,"targetTimeReserveMs":100,"adaptive":false}}' --json
# Press Increment once in the app.
pnpm --filter @genie-react/expo-demo exec genie-react call \
  react_profile_snapshot '{"label":"expo-increment"}' --json
```

Require complete coverage with zero budget-exhausted commits. If the result is incomplete, discard
the window and rerun with the smallest larger explicit budget that covers the app; `timeLimitMs`
bounds synchronous commit analysis and should not be raised farther than needed.

The lifecycle visibility panel uses `react-freeze` and React Activity. Start an observation and
read its probe after each button press:

```sh
pnpm --filter @genie-react/expo-demo exec genie-react call react_clear_renders '{}' --json
pnpm --filter @genie-react/expo-demo exec genie-react call \
  react_component_cohort '{"component":"VisibilityProbe"}' --json
```

Increment the probe, then use **Freeze** or **Hide** and **Thaw**. Hidden instances should keep the
same mount ID and count, with `reactVisibility:"hidden"` while hidden. **Unmount** should produce
an unmounted cohort entry; **Thaw** then mounts a new probe with count zero. Hidden React evidence
does not identify the navigation or freeze mechanism that caused it.

List the complete runtime catalog after the tool fixtures have mounted:

```sh
pnpm --filter @genie-react/expo-demo exec genie-react tools --json
```

Some browser-specific results are intentionally unavailable in React Native. For example,
`react_component_for_dom` reports that there is no DOM, `browser_measure_memory` reports whether
the required browser API is unavailable, and `plugin_emit` returns `ok:false` when no TanStack
DevTools event bus has been injected. Native host lookup through `react_dom_for_component` remains
supported and returns React Native selectors such as `testID`.

Run the automated TypeScript and Metro bundle checks for iOS and Android:

```sh
pnpm --filter @genie-react/expo-demo check
```

The development Babel configuration enables `genie-react/babel`. After pressing Increment,
`react_get_renders` and `react_component_cohort` should identify `MemoNameRow`, `InnerNamedRow`,
and `CustomMemoRow`. This verifies binding names, named inner functions, and explicit wrapper
names respectively. Production exports omit the generated binding-name metadata.

## Expo Router navigation fixture

Temporarily set this example's `package.json` main to `router-entry.ts`, then restart Expo with a
cleared Metro cache. Keep the hub running in the other terminal:

```sh
pnpm --filter genie-react build
pnpm --filter @genie-react/expo-demo exec expo start --clear
```

`router-entry.ts` installs the early hook and starts Expo Router. `app/_layout.tsx` registers
`createNavigationTools` and forwards native-stack state and transition events. The root and
`/details` routes expose visible controls so a device driver can independently verify the landing
screen.

```sh
pnpm --filter @genie-react/expo-demo exec genie-react call app_navigate \
  '{"href":"/details","mode":"push"}' --json
pnpm --filter @genie-react/expo-demo exec genie-react call app_navigate \
  '{"href":"/details","mode":"push"}' --json
pnpm --filter @genie-react/expo-demo exec genie-react call app_navigate_back '{}' --json
pnpm --filter @genie-react/expo-demo exec genie-react call app_navigate \
  '{"href":"/","mode":"dismiss_to"}' --json
```

Each successful move returns `settled:true`, `reason:"transition-end"`, the actual route and stack
depth. Starting at home, these calls report depths 2, 3, 2 and 1. The two pushes have distinct route
keys. No sleep is required to read the resulting route. An already-current `navigate` returns a
no-op; `replace` changes the current screen without growing the stack. A timeout is explicitly
unsettled and must not trigger a blind retry. The adapter is opt-in and does not replace existing
app-owned handlers automatically.

Restore `package.json` main to `index.ts` after this fixture run. The fixture's href matcher covers
its two parameterless routes; an app with parameters must compare the full destination.
