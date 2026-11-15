---
'genie-react': minor
'@genie-react/cli': minor
---

Add `genie-react verify` to check a fix with a verdict instead of reading evidence by hand. Declare claims, drive the interaction with your UI driver, and end the window:

```bash
npx genie-react verify begin --session my-agent --name "type in filter" \
  --claim 'render StatusBadge max 0' --claim 'render SearchScreen min 1' --claim 'boundaries clean'
npx genie-react verify end <id> --session my-agent
```

Claims cover render counts (`render <Name> max|min <N>`, with `counting updates`), renders only for named causes (`render <Name> only props.items,state[0]`), effect runs (`effect <Name>[#index] max <N>`), effects that stop running (`effect <Name> settles`), and error boundaries (`boundaries clean`, `boundaries clean-at-end`). `end` waits for React, Query and Router to settle with recording still on, keeps recording for a short tail, freezes, and decides each claim as `pass`, `fail`, `refused` or `inconclusive`. A failed claim decides the run.

- The exit code carries the verdict: 0 pass, 1 fail, 4 refused, 5 inconclusive. Usage errors exit 2, a refused hub connection 3, an unreachable hub or app 69, a timeout 124.
- A run never passes on evidence that cannot prove it. An upper bound passes only on exact, complete counts. Each refusal names one reason and the command that fixes it: a budget that skipped the target, evicted events, an inferred cause, a target that was renamed, ambiguous, hidden or frozen, a window with no React commit, a reload, a Fast Refresh, a hidden tab, an active override, or work still arriving after the app settled. A key change that turns updates into mounts fails a `counting updates` claim, and a StrictMode replay alone is `inconclusive`.
- While a window records, the hub refuses `react_clear_renders`, `react_profile_start`, `react_profile_stop`, `devtools_interaction_begin` and the override tools on that tab with `hubCode: "VERIFICATION_ACTIVE"`. `verify abort <id>` releases it, and the hub expires an unfinished window after five minutes.
- Each verdict reports the attempt number and earlier verdicts for the same claims on the same tab, and says on its first line when a pass follows failures on the same code. The history lives in hub memory and resets when the hub restarts.
- `verify show <id> --claim N` prints every deciding item for a claim; `--section guards` and `--section raw:<tool>` print the guards and retained tool results. The hub answers the new `devtools_verify_begin`, `devtools_verify_end`, `devtools_verify_read` and `devtools_verify_abort` tools itself, so an app cannot forge a verdict.

Every CLI failure now carries `exit: {code, class}`: the code from this taxonomy that its command will use once all commands adopt it. Commands other than `verify` still exit 0 or 1.

New evidence in the app runtime, used by `verify` and available directly:

- `react_error_state` accepts `afterDocumentCommitId` and returns `catchLog`, every catch committed since, including boundaries that have already reset or unmounted. Catches are now recorded even while profiling is paused or when the analysis budget skips the boundary. Before, `react_error_state` missed a boundary that caught after `react_profile_stop`.
- New `browser_visibility` tool reports whether the tab is visible and how many times it was hidden. On React Native, pass `AppState` to `startGenie` or `<Genie />`.
- `react_clear_renders` and `react_profile_start` report `strictMode`.
- `react_profile_stop` returns `documentCommitId`, `observation` and the window's coverage as of the stop. Commits after the stop are now counted as `pausedCommits` instead of as failed analysis, and still mark later reads incomplete.
- `query_is_fetching` lists `simulatedQueries`, and `query_notifications` reports `evictedEvents`.
