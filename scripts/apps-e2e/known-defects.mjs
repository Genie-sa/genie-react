import { CheckFailure } from './harness.mjs'

const ALL_APPS = ['vite-demo', 'router-demo', 'demo', 'plain-demo', 'next-demo']
const QUERY_APPS = ['vite-demo', 'router-demo', 'demo', 'next-demo']

/** Product defects the matrix proves on every run. A `probe` defect runs an assertion of the correct behaviour on each listed app; a `claim` defect explains findings of one kind at the listed tool sites, from the contract sweep or any later call. A reproduced defect keeps the run green only because it is listed here; one that stops reproducing on a listed app fails the run until that app is removed. */
const KNOWN_DEFECTS = {
  'KD-1': {
    apps: ['vite-demo'],
    severity: 'high',
    tool: 'genie() Vite plugin, linked or workspace install',
    expected:
      'An app without @tanstack/react-router renders, and <Genie /> mounts its Query and app-tool collectors.',
    actual:
      'The page throws "use-sync-external-store/shim/with-selector.js does not provide an export named useSyncExternalStoreWithSelector", React renders nothing, and status still reports ready:true. The optional-peer stub resolves @tanstack/react-router from genie-react\'s own directory, where its devDependency exists (packages/genie-react/src/vite/plugin.ts:476), but the pre-bundle list checks only the app root (:245), so the router\'s CommonJS dependency is served raw. Any genie link or workspace install with that devDependency present is affected.',
    repro:
      'cd apps/vite-demo && vite --port <free>; open the page and read the console; genie-react call react_get_tree --json returns nodes: []',
  },
  'KD-2': {
    apps: ['demo'],
    severity: 'high',
    tool: 'router_* tools under TanStack Start',
    expected:
      '<Genie /> inside a TanStack Start app registers the router collector, so status lists the router domain and its tools.',
    actual:
      'The router domain never appears and nothing says why. Start serves the app\'s @tanstack/react-router as raw ESM while the plugin pre-bundles "genie-react > @tanstack/react-router" (packages/genie-react/src/vite/plugin.ts:275), so the page loads two router module instances and useRouter() in <Genie /> (packages/genie-react/src/react/genie.ts:33) sees no router context. Nothing here is workspace-specific.',
    repro:
      'cd apps/demo && vite dev --port <free>; open /?_genie=x; genie-react status --session x --json lists no router domain',
  },
  'KD-4': {
    severity: 'medium',
    tool: 'source resolution behind react_find_components, react_get_renders and related tools',
    expected:
      'Resolving component sources only requests URLs the page can load, so the app console stays clean.',
    actual:
      "Source resolution (packages/genie-react/src/collectors/react/source.ts, via bippy getSourceMap) fetches whatever path a stack frame or source map names. Under Next.js it calls fetch() on about://React/Server/file:///… and file:///… URLs, which the browser refuses. Every miss is a console error in the developer's app: dozens per session, 255 in one next-demo run. The TanStack Start and esbuild cases no longer reproduce.",
    repro:
      'cd apps/next-demo && next dev --port <free>; open /?_genie=x; genie-react call react_get_renders \'{"appOnly":true}\' --session x; read the browser console',
    claim: {
      kind: 'genie-resource-failure',
      sites: [{ tool: 'source-map resolution', apps: ['next-demo'] }],
    },
  },
  'KD-5': {
    severity: 'medium',
    tool: 'router_get_state',
    expected:
      'The result carries isTransitioning: boolean, as its advertised output outline requires.',
    actual:
      'isTransitioning is absent on every call: the collector destructures it from TanStack Router state, which no longer has it, and JSON drops the undefined value (packages/genie-react/src/collectors/tanstack/router.ts:270).',
    repro: "genie-react call router_get_state '{}' --json --session <name>",
    claim: {
      kind: 'outline-drift',
      sites: [{ tool: 'router_get_state', fields: ['isTransitioning'], apps: ['router-demo'] }],
    },
  },
  'KD-6': {
    severity: 'low',
    tool: 'router_match_route, query_get, query_get_data, mutation_get',
    expected:
      'A field the output outline marks required is present on every result, as null when there is no value.',
    actual:
      'Fields typed z.unknown() are advertised as required, but handlers leave them undefined and JSON drops them: router_match_route params on a miss (packages/genie-react/src/collectors/tanstack/router.ts:350), query_get data while a query has no data, query_get_data data when found:false, mutation_get mutationKey when the app set none.',
    repro:
      'genie-react call query_simulate_state \'{"queryKey":["greeting"],"state":"pending"}\', then genie-react call query_get \'{"queryKey":["greeting"]}\' --json (router-demo)',
    claim: {
      kind: 'outline-drift',
      sites: [
        { tool: 'router_match_route', fields: ['params'], apps: ['router-demo'] },
        { tool: 'query_get', fields: ['data'], apps: QUERY_APPS },
        { tool: 'query_get_data', fields: ['data'], apps: QUERY_APPS },
        {
          tool: 'mutation_get',
          fields: ['mutationKey'],
          apps: ['router-demo', 'vite-demo', 'next-demo'],
        },
      ],
    },
  },
  'KD-7': {
    severity: 'low',
    tool: 'react_find_components, query_get, query_get_data, stylex_inspect',
    expected:
      'A tool that needs one of several keys declares it in its input schema (anyOf/oneOf required), so an agent building arguments from inputJsonSchema can call it.',
    actual:
      'Each schema declares no required key, yet {} is rejected: invalid_args for three, and a tool_error instead of invalid_args for stylex_inspect.',
    repro: "genie-react call query_get '{}' --json --session <name>",
    claim: {
      kind: 'underspecified-input',
      sites: [
        { tool: 'react_find_components', apps: ALL_APPS },
        { tool: 'stylex_inspect', apps: ALL_APPS },
        { tool: 'query_get', apps: QUERY_APPS },
        { tool: 'query_get_data', apps: QUERY_APPS },
      ],
    },
  },
  'KD-8': {
    apps: ['vite-demo', 'router-demo', 'demo', 'next-demo'],
    severity: 'low',
    tool: 'hub shutdown in the genie() Vite plugin and registerGenie()',
    expected:
      'Stopping vite dev or next dev with Ctrl-C or SIGTERM removes .genie/bridge.json and its agent-token file.',
    actual:
      'Both stay behind. The Vite close handler starts removeDiscovery without awaiting it and Vite exits first (packages/genie-react/src/vite/plugin.ts:359); registerGenie installs no shutdown path at all (packages/genie-react/src/next/register.ts:15). The CLI later rejects the file as stale, but the agent-token file outlives the hub. The standalone genie-react hub cleans up correctly.',
    repro: 'cd apps/router-demo && vite dev --port <free>; send SIGINT; ls .genie/bridge.json',
  },
  'KD-9': {
    apps: ['plain-demo'],
    severity: 'low',
    tool: 'component names in react_* tools for esbuild bundles',
    expected:
      'const MemoChildWithUnstableProp = memo(function MemoChildWithUnstableProp…) is reported under its source name, which its source map records.',
    actual:
      'It is reported as MemoChildWithUnstableProp2, the name esbuild gives the inner function to avoid the collision, so react_find_components {"component":"MemoChildWithUnstableProp","exact":true} finds nothing while the source location is right.',
    repro:
      'cd apps/plain-demo && pnpm dev plus genie-react hub; genie-react call react_find_components \'{"component":"MemoChildWithUnstableProp","exact":true}\' --json',
  },
  'KD-10': {
    apps: ['next-demo'],
    severity: 'medium',
    tool: 'workspace dependency skew (repository, not the published package)',
    expected:
      'apps/next-demo type-checks, so next build succeeds without skipping its TypeScript step.',
    actual:
      "app/genie-manual.tsx:14 fails: queryCollector is typed against genie-react's own devDependency @tanstack/query-core 5.101.2, while the app resolves 5.104.1, and QueryClient's private fields make the two incompatible. The demo's next build and typecheck scripts both fail on main; CI runs neither.",
    repro: 'pnpm --filter @genie-react/next-demo typecheck',
  },
  'KD-11': {
    apps: ['next-demo'],
    severity: 'medium',
    tool: 'genie-react/next production build',
    expected:
      "A Next.js production build carries none of Genie's runtime, even behind the NODE_ENV guard in instrumentation.ts.",
    actual:
      "next build emits the whole 444 KB browser client (bippy, every tool contract, the hub client) as .next/static/media/client.global.iife.<hash>.js, publicly served by next start. The hub locates its client with new URL('./client.global.iife.js', import.meta.url) (packages/genie-react/src/hub/standalone.ts:78), which Turbopack treats as an asset reference from the instrumentation import graph. Pages never load it.",
    repro: 'cd apps/next-demo && next build && ls .next/static/media | grep client.global.iife',
  },
}

function defectApps(defect) {
  return defect.apps ?? [...new Set(defect.claim.sites.flatMap((site) => site.apps))]
}

function sitesFor(defect, app) {
  return defect.claim?.sites.filter((site) => site.apps.includes(app)) ?? []
}

function explains(defect, app, { kind, tool, details = [] }) {
  if (defect.claim?.kind !== kind) return false
  return sitesFor(defect, app).some(
    (site) =>
      site.tool === tool &&
      (!site.fields ||
        details.every((detail) => site.fields.some((field) => String(detail).includes(field)))),
  )
}

export class DefectTracker {
  #reproduced = new Map()
  #probed = new Set()
  #candidates = new Set()

  #record(id, app, observed) {
    const entry = this.#reproduced.get(id) ?? { apps: [], sites: new Set(), observed }
    if (!entry.apps.includes(app)) entry.apps.push(app)
    this.#reproduced.set(id, entry)
    return entry
  }

  registered(id, app) {
    const defect = KNOWN_DEFECTS[id]
    return defect !== undefined && defectApps(defect).includes(app)
  }

  async expect(id, app, probe) {
    if (!this.registered(id, app)) throw new Error(`${id} is not registered for ${app}`)
    this.#probed.add(`${id}:${app}`)
    try {
      await probe()
    } catch (error) {
      this.#record(id, app, error instanceof Error ? error.message : String(error))
      return false
    }
    throw new CheckFailure(
      `${id} no longer reproduces on ${app}: the correct behaviour now holds. Remove ${app} from ${id} in scripts/apps-e2e/known-defects.mjs.`,
      KNOWN_DEFECTS[id],
    )
  }

  attempted(app, tool) {
    this.#candidates.add(`${app}:${tool}`)
  }

  /** True when a registered defect explains this finding; the finding is then recorded instead of failing the run. */
  claim(app, finding) {
    const match = Object.entries(KNOWN_DEFECTS).find(([, defect]) => explains(defect, app, finding))
    if (!match) return false
    const [id] = match
    const observed = `${finding.kind} on ${finding.tool}: ${JSON.stringify(finding.details ?? []).slice(0, 200)}`
    this.#record(id, app, observed).sites.add(`${app}:${finding.tool}`)
    return true
  }

  assertExercised(app) {
    const problems = []
    for (const [id, defect] of Object.entries(KNOWN_DEFECTS)) {
      if (!defectApps(defect).includes(app)) continue
      if (!defect.claim) {
        if (!this.#probed.has(`${id}:${app}`)) problems.push(`${id} was never probed`)
        continue
      }
      const seen = this.#reproduced.get(id)?.sites ?? new Set()
      for (const site of sitesFor(defect, app)) {
        const key = `${app}:${site.tool}`
        if (!this.#candidates.has(key)) {
          problems.push(`${id} lists ${site.tool} on ${app}, but it was never called there`)
        } else if (!seen.has(key)) {
          problems.push(`${id} no longer reproduces for ${site.tool}; remove ${app} from that site`)
        }
      }
    }
    if (problems.length > 0)
      throw new CheckFailure(`${app}: known-defect registry is out of date`, problems)
  }

  reproduced() {
    return [...this.#reproduced]
      .map(([id, seen]) => ({ id, ...KNOWN_DEFECTS[id], ...seen }))
      .sort((left, right) => Number(left.id.slice(3)) - Number(right.id.slice(3)))
  }
}

export function formatKnownDefects(reproduced) {
  if (reproduced.length === 0) return ''
  const bar = '!'.repeat(78)
  const lines = [
    bar,
    `! KNOWN DEFECTS: ${reproduced.length} reproduced. The matrix passes only because each is listed`,
    '! in scripts/apps-e2e/known-defects.mjs. Fix the product, then delete the entry.',
    bar,
  ]
  for (const defect of reproduced) {
    lines.push(
      `! ${defect.id} [${defect.severity}] ${defect.apps.join(', ')} · ${defect.tool}`,
      `!   expected: ${defect.expected}`,
      `!   actual:   ${defect.actual}`,
      `!   repro:    ${defect.repro}`,
      `!   observed: ${defect.observed.split('\n')[0].slice(0, 300)}`,
    )
  }
  lines.push(bar)
  return `${lines.join('\n')}\n`
}

export function markdownSummary(results, reproduced) {
  const lines = ['## Apps E2E matrix', '', '| App | Result | Time |', '| --- | --- | --- |']
  for (const result of results) {
    lines.push(
      `| ${result.app} | ${result.ok ? 'pass' : 'fail'} | ${(result.ms / 1000).toFixed(1)} s |`,
    )
  }
  if (reproduced.length > 0) {
    lines.push(
      '',
      `### ${reproduced.length} known defect(s) reproduced`,
      '',
      '| ID | Severity | Apps | Tool | Actual |',
      '| --- | --- | --- | --- | --- |',
    )
    for (const defect of reproduced) {
      const actual = defect.actual.replaceAll('|', '\\|')
      lines.push(
        `| ${defect.id} | ${defect.severity} | ${defect.apps.join(', ')} | ${defect.tool} | ${actual} |`,
      )
    }
  }
  return `${lines.join('\n')}\n`
}
