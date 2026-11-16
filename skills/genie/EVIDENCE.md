# Reading Genie evidence

`verify` applies these rules itself. Use this file for results read outside it.

## Coverage

- An empty result or a smaller count proves nothing until coverage is complete. `coverage.incompleteBecause` names each gap and its `next` step.
- `commits-not-observed`: commits happened with no window open. Open one and repeat the action.
- `commits-during-fast-refresh`: the window saw a Fast Refresh edit. Wait a second after it applies, open a new window, and repeat.
- Quiesce covers React only. When Query or Router work belongs in the capture, also run `devtools_wait` with condition `settled`.

## Renders

- `necessity: unnecessary` means the inputs were equal or the render wrote nothing. With `necessityReason` `callbacks-changed` or `effects-scheduled`, check behaviour before removing the render.
- `origin` names the ancestor whose own update started a cascade, usually where the fix goes. `parent` is only the tree parent.
- A class state cause carries `classUpdates`: each `setState` with its `fields` and `caller`. `phase: "lifecycle"` is exact; `event` and `react-work` are inferred.
- `external-store` causes appear only when the subscription fired; `changedFields` names what changed.
- `component` matches one exact display name. `exact:false` matches substrings and can mix components; read `componentMatch`.
- `appOnly:true` hides only known library code. A library provider written in your file is still `library`.

## Effects, data and errors

- An effect belongs to the hook that declared it, so one inside `useQuery` is the library's. `hotness: hot` means it re-ran with no dependency changed.
- A scheduled effect did not necessarily run or clean up; read its execution evidence.
- An exact Query or Router cause needs its matching notification. Nearby timestamps are not a cause.
- A caught error with `rendered.output: nothing` was swallowed: the user sees nothing.
- `react_suspense` shows one server I/O per `await`; for `Promise.all`, only the slowest.
- Timeline request `query` values are salted hashes unless the recording used `"queryValues":"plain"`. `finishedAfterNewer` marks a response that arrived after a newer one.
- Source `line: null` means the mapped line did not match the file; search the file for the component.

## Before and after

Take at least six captures per side, each from a fresh window: clear, act, check the UI, wait, then `devtools_capture_create`. `devtools_capture_compare` drops one warm-up and needs five samples. Only `pass` on a requested budget, in the expected direction, is an improvement. Development timings do not predict production.

## Output and failures

- `null`, `false`, `0` and empty lists are evidence.
- A first line `truncated max_bytes:` means stdout is incomplete. Read the file at `outputPath`, or run a `$` suggestion to ask for less.
- A failure prints `error <reason>: <message>` and `next: $ <command>` when recovery is known. `didYouMean` maps unknown keys; `correctedExample` placeholders need real values.
- After a timeout on a call that changes state, or when `details.mayHaveCompleted` is true, inspect the app before retrying.
- `conflict` codes: `OBSERVATION_SUPERSEDED`, start your window again; `STATE_HELD`, leave the other agent's overrides and use your own tab; `VERIFICATION_ACTIVE` or `INTERACTION_ACTIVE`, run the `next` command.
- When saving browser state, leave out the `genie-react:*` sessionStorage keys; they bind a tab to its session.

## Reporting a Genie bug

When a failure carries `feedback`, or Genie crashes or gives wrong or confusing output, offer to report it. Pipe a short description of Genie's behaviour, never the user's code or data, into the printed `feedback` command or `npx genie-react feedback --kind friction --message -`, and show the user the preview. The issue is public and posted from the user's GitHub account, so submit it only after the user agrees.
