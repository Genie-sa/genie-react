# Agent evals

Measures whether a real coding agent can solve runtime-debugging tasks with Genie and [`agent-browser`](https://github.com/vercel-labs/agent-browser), and what it costs in calls, tokens, and time.

Each trial:

1. Packs `genie-react` and `@genie-react/cli`, installs them with the fixture's dependencies into a consumer project outside the repo (once per run).
2. Copies `fixture-app` to a temporary git repo, runs `genie-react init --yes`, and links the installed skill where the agent discovers it.
3. Starts the Vite dev server, opens the app in an `agent-browser` session, and runs the agent non-interactively in that directory with an allowlisted environment (auth and locale variables, and a `PATH` of the trial's bins, the required tools, and system directories).
4. Grades the outcome with code. Diagnose tasks need a correct final JSON answer (`component`, `cause`, `file`) and no edits. Fix tasks need edits confined to `src/`, a passing typecheck, and a runtime probe that replays the interaction and checks Genie evidence; their JSON answer is recorded but does not decide the grade.

Claude runs with `--setting-sources project --strict-mcp-config --permission-mode dontAsk` and a generated `--settings` file kept outside the trial. Its Bash commands run in Claude Code's OS sandbox: writes only inside the trial, no reads of the repository checkouts, the system temp directory (other trials and the shared install), or agent transcript stores, and network only to localhost and the agent-browser socket. It may run `genie-react`, `agent-browser`, and `sleep`, `echo`, `cat`, `head`, `tail`, `grep`, `jq`, `wc`, `sort`, `ls`; `Read`, `Grep`, and `Glob` are limited to the trial and `Edit` to its `src/` in fix tasks. Any other command or path is denied and counted. Codex runs without user config or rules and with its workspace-write sandbox, which cannot restrict reads, so Codex results are labelled "reads not sandboxed".

The summary reports outcome and path separately. **Runtime evidence** is the share of trials with at least one successful Genie tool call (`genie-react call` or a `batch` item). A pass without runtime evidence means the agent solved the task by reading source.

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

Each finished trial is appended to `evals/results/<run-id>.jsonl`, so a crash keeps completed trials, and a harness error fails only its own trial. Results are written to `evals/results/<run-id>.json` (every trial with checks, answer, patch, call breakdown, Genie error reasons, permission denials, usage) and `<run-id>.md` (summary table). CI runs only `pnpm eval --dry-run`; live runs need agent credentials and are never run in CI. Transcripts are in `evals/results/<run-id>/`. Read them: a failing grade can be a grader bug, and a passing grade can hide a wasteful path.

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
   - `referenceAnswer` that must pass and `decoyAnswers`, plausible wrong answers that must fail. Include near misses: the right component and file with a wrong cause, and a list of several components. The `component` check accepts at most two names, all from `truth.components`.
   - `referenceFix`: exact `{ file, find, replace }` edits for the minimal correct fix.
   - For `"mode": "fix"`, a `probe`: `agent-browser` argument lists in `steps`, plus `renders` (`component`, `maxUpdates`), `text` (`selector`, `includes`), or `noCaughtErrors`.
3. Run `pnpm eval --dry-run --runtime` and `pnpm test`.
