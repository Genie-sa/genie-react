# Agent evals

Measures whether a real coding agent can solve runtime-debugging tasks with Genie and [`agent-browser`](https://github.com/vercel-labs/agent-browser), and what it costs in calls, tokens, and time.

Each trial:

1. Packs `genie-react` and `@genie-react/cli`, installs them with the fixture's dependencies into a consumer project outside the repo (once per run).
2. Copies `fixture-app` to a temporary git repo, runs `genie-react init --yes`, and links the installed skill where the agent discovers it.
3. Starts the Vite dev server and runs the agent non-interactively in that directory. Claude runs with `--setting-sources project --strict-mcp-config --permission-mode dontAsk`. It can use `genie-react`, `agent-browser`, a few read-only shell helpers (`cd`, `export`, `sleep`, `cat`, `grep`, …), file reading tools, and `Edit` for fix tasks. Any other command is denied and counted.
4. Grades the outcome with code: the final JSON answer (`component`, `cause`, `file`), no edits for diagnose tasks, and for fix tasks a typecheck plus a runtime probe that replays the interaction and checks Genie evidence.

The summary reports outcome and path separately. **Runtime evidence** is the share of trials with at least one `genie-react call` that returned data. A pass without runtime evidence means the agent solved the task by reading source.

## Run

Requires `agent-browser`, `claude` (or `codex`), and network access for the consumer install.

```bash
pnpm eval --dry-run                    # validate tasks, graders, reference fixes; no model
pnpm eval --dry-run --runtime          # also prove each probe fails on the bug and passes on the reference fix
pnpm eval --task memo-object-prop --trials 1   # cheapest real smoke run
pnpm eval --trials 3                   # dev split, pass@k and pass^k over 3 trials
pnpm eval --split held-out --trials 3  # held-out split; avoid tuning prompts or the skill against it
pnpm eval --agent codex --task memo-object-prop --trials 1
```

Useful flags: `--model`, `--max-turns`, `--max-budget-usd` (per trial, Claude only), `--timeout-ms`, `--skip-build`, `--keep` (keeps trial directories). `pnpm eval --help` lists all options.

Results are written to `evals/results/<run-id>.json` (every trial with checks, answer, patch, call breakdown, Genie error reasons, permission denials, usage) and `<run-id>.md` (summary table). CI runs only `pnpm eval --dry-run`; live runs need agent credentials and are never run in CI. Transcripts are in `evals/results/<run-id>/`. Read them: a failing grade can be a grader bug, and a passing grade can hide a wasteful path.

## Tasks

`tasks/<id>.json` holds one task. The fixture contains one seeded bug per screen, selected with `?screen=<name>`:

| Screen | Seeded bug |
| --- | --- |
| `search` | Memoized child gets a new object prop each render |
| `dashboard` | Context provider value recreated each render |
| `reports` | Effect sets state with an unstable object dependency |
| `tasks` | Mutation invalidates a query key that does not match the list |
| `overview` | `staleTime: Infinity` keeps showing old data |
| `account` | Error boundary renders nothing for a thrown error |
| `cart` | External store selector returns a new object every call |

Tasks marked `"split": "held-out"` are excluded from the default run.

## Add a task

1. Seed the bug in `fixture-app` on a new or existing screen. Use neutral names: the agent can read the source, and file or component names must not reveal the bug.
2. Add `tasks/<id>.json` with:
   - `prompt`: how a user would report the symptom.
   - `truth`: accepted `components`, accepted project-relative `files`, and `causePatterns`. Every pattern must match the answer's cause, case-insensitively.
   - `referenceAnswer` that must pass and `decoyAnswer`, a plausible wrong answer, that must fail.
   - `referenceFix`: exact `{ file, find, replace }` edits for the minimal correct fix.
   - For `"mode": "fix"`, a `probe`: `agent-browser` argument lists in `steps`, plus `renders` (`component`, `maxUpdates`), `text` (`selector`, `includes`), or `noCaughtErrors`.
3. Run `pnpm eval --dry-run --runtime` and `pnpm test`.
