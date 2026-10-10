/**
 * @typedef {{ component: string, cause: string, file: string }} Answer
 * @typedef {{ components: string[], files: string[], causePatterns: string[], summary: string }} Truth
 * @typedef {{ name: string, pass: boolean, detail: string }} Check
 * @typedef {{ pass: boolean, answer: Answer | null, checks: Check[] }} Grade
 */

const OBJECT_START = /\{\s*"/g

/**
 * Returns the balanced JSON object text starting at `start`, skipping braces inside strings.
 * @param {string} text
 * @param {number} start
 * @returns {string | null}
 */
function balancedObject(text, start) {
  let depth = 0
  let inString = false
  for (let index = start; index < text.length; index += 1) {
    const char = text[index]
    if (inString) {
      if (char === '\\') index += 1
      else if (char === '"') inString = false
    } else if (char === '"') inString = true
    else if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) return text.slice(start, index + 1)
    }
  }
  return null
}

/**
 * @param {unknown} value
 * @returns {Answer | null}
 */
function toAnswer(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const record = /** @type {Record<string, unknown>} */ (value)
  if (!['component', 'cause', 'file'].some((key) => key in record)) return null
  const text = (/** @type {string} */ key) => (typeof record[key] === 'string' ? record[key] : '')
  return { component: text('component'), cause: text('cause'), file: text('file') }
}

/**
 * Returns the last JSON answer object in the agent's final message, fenced or not.
 * @param {string} text
 * @returns {Answer | null}
 */
export function extractAnswer(text) {
  /** @type {Answer | null} */
  let latest = null
  for (const match of text.matchAll(OBJECT_START)) {
    const candidate = balancedObject(text, match.index)
    if (!candidate) continue
    try {
      latest = toAnswer(JSON.parse(candidate)) ?? latest
    } catch {}
  }
  return latest
}

/**
 * Reduces absolute, `./`-prefixed, or `:line:col`-suffixed paths to a project-relative path.
 * @param {string} file
 * @param {string} [projectRoot]
 * @returns {string}
 */
export function normalizeFile(file, projectRoot) {
  let path = file.trim().replaceAll('\\', '/').replace(/^`|`$/g, '')
  path = path.replace(/(:\d+){1,2}$/, '').replace(/#L\d+(-L?\d+)?$/, '')
  const roots = projectRoot ? [projectRoot, projectRoot.replace(/^\/private/, '')] : []
  for (const root of roots) {
    const prefix = `${root.replace(/\/$/, '')}/`
    if (path.startsWith(prefix)) path = path.slice(prefix.length)
  }
  return path.replace(/^\.\//, '').replace(/^\/+/, '')
}

/**
 * @param {string} answered
 * @param {string} expected
 */
function sameFile(answered, expected) {
  if (!answered) return false
  return (
    answered === expected || expected.endsWith(`/${answered}`) || answered.endsWith(`/${expected}`)
  )
}

/**
 * @param {Answer | null} answer
 * @param {Truth} truth
 * @param {{ projectRoot?: string }} [options]
 * @returns {Grade}
 */
export function gradeAnswer(answer, truth, options = {}) {
  if (!answer) {
    return {
      pass: false,
      answer: null,
      checks: [{ name: 'answer', pass: false, detail: 'no JSON answer block found' }],
    }
  }
  const names = answer.component.match(/[A-Za-z_$][\w$]*/g) ?? []
  const file = normalizeFile(answer.file, options.projectRoot)
  const missingPatterns = truth.causePatterns.filter(
    (pattern) => !new RegExp(pattern, 'i').test(answer.cause),
  )
  /** @type {Check[]} */
  const checks = [
    {
      name: 'component',
      pass: names.some((name) => truth.components.includes(name)),
      detail: `answered "${answer.component}", accepted ${truth.components.join(' | ')}`,
    },
    {
      name: 'file',
      pass: truth.files.some((expected) => sameFile(file, expected)),
      detail: `answered "${file}", accepted ${truth.files.join(' | ')}`,
    },
    {
      name: 'cause',
      pass: missingPatterns.length === 0,
      detail:
        missingPatterns.length === 0
          ? 'all cause patterns matched'
          : `unmatched patterns: ${missingPatterns.map((pattern) => `/${pattern}/i`).join(', ')}`,
    },
  ]
  return { pass: checks.every((check) => check.pass), answer, checks }
}

/**
 * @param {number} n
 * @param {number} k
 */
function choose(n, k) {
  if (k < 0 || k > n) return 0
  let result = 1
  for (let index = 1; index <= k; index += 1) result = (result * (n - k + index)) / index
  return result
}

/**
 * Unbiased estimate of the chance that at least one of k trials passes (Chen et al., 2021).
 * @param {number} n
 * @param {number} passed
 * @param {number} k
 */
export function passAtK(n, passed, k) {
  if (n === 0 || k > n) return null
  return 1 - choose(n - passed, k) / choose(n, k)
}

/**
 * Estimate of the chance that all k trials pass, the reliability metric from τ-bench.
 * @param {number} n
 * @param {number} passed
 * @param {number} k
 */
export function passHatK(n, passed, k) {
  if (n === 0 || k > n) return null
  return choose(passed, k) / choose(n, k)
}
