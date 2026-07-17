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
