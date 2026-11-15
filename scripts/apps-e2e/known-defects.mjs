import { CheckFailure } from './harness.mjs'

/** Product defects the matrix proves on every run. A `probe` defect runs an assertion of the correct behaviour on each listed app; a `claim` defect explains findings of one kind at the listed tool sites, from the contract sweep or any later call. A reproduced defect keeps the run green only because it is listed here; one that stops reproducing on a listed app fails the run until that app is removed. */
const KNOWN_DEFECTS = {
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
