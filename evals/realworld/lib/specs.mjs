import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * @typedef {{ file: string, find: string, replace: string }} Edit
 * @typedef {{ script: string, genie: 'observable' | 'blocked', evidence: string[], blockedReason?: string }} ProbeSpec
 * @typedef {{
 *   id: string,
 *   kind: 'bug' | 'decoy',
 *   category: 'verify' | 'fix' | 'optimise',
 *   symptom: string,
 *   truth: { components: string[], files: string[], cause: string },
 *   referenceFix?: Edit[],
 *   probe: ProbeSpec,
 *   expectation?: 'not-flagged' | 'known-false-positive',
 *   finding?: string,
 *   path: string,
 * }} Spec
 */

const SPEC_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const KINDS = new Set(['bug', 'decoy'])
const CATEGORIES = new Set(['verify', 'fix', 'optimise'])
const GENIE_STATES = new Set(['observable', 'blocked'])
const DECOY_EXPECTATIONS = new Set(['not-flagged', 'known-false-positive'])

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * @param {unknown} value
 * @returns {value is string[]}
 */
function isStringList(value) {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === 'string' && item.length > 0)
  )
}

/**
 * Returns every problem with one parsed spec; an empty list means the spec is valid.
 * @param {unknown} spec
 * @param {string} fileName
 * @returns {string[]}
 */
export function validateSpec(spec, fileName) {
  if (!isRecord(spec)) return [`${fileName}: expected a JSON object`]
  /** @type {string[]} */
  const problems = []
  const fail = (/** @type {string} */ message) => problems.push(`${fileName}: ${message}`)
  if (typeof spec.id !== 'string' || !SPEC_ID.test(spec.id)) fail('id must be kebab-case')
  else if (`${spec.id}.json` !== fileName) fail(`id ${spec.id} must match the file name`)
  if (!KINDS.has(/** @type {string} */ (spec.kind))) fail('kind must be "bug" or "decoy"')
  if (!CATEGORIES.has(/** @type {string} */ (spec.category)))
    fail('category must be verify, fix or optimise')
  if (typeof spec.symptom !== 'string' || spec.symptom.length < 20)
    fail('symptom must describe what a user reports')
  const truth = spec.truth
  if (
    !isRecord(truth) ||
    !isStringList(truth.components) ||
    !isStringList(truth.files) ||
    typeof truth.cause !== 'string'
  ) {
    fail('truth needs components, files and cause')
  }
  const probe = spec.probe
  if (
    !isRecord(probe) ||
    typeof probe.script !== 'string' ||
    !GENIE_STATES.has(/** @type {string} */ (probe.genie)) ||
    !isStringList(probe.evidence)
  ) {
    fail('probe needs script, genie ("observable" or "blocked") and evidence')
  } else if (probe.genie === 'blocked' && typeof probe.blockedReason !== 'string') {
    fail('a blocked probe must explain the missing evidence in blockedReason')
  }
  if (spec.kind === 'bug') {
    const edits = spec.referenceFix
    const valid =
      Array.isArray(edits) &&
      edits.length > 0 &&
      edits.every(
        (edit) =>
          isRecord(edit) &&
          ['file', 'find', 'replace'].every((key) => typeof edit[key] === 'string') &&
          edit.find !== edit.replace,
      )
    if (!valid) fail('a bug needs referenceFix edits of { file, find, replace }')
  }
  if (spec.kind === 'decoy') {
    if (spec.referenceFix !== undefined) fail('a decoy is correct code and has no referenceFix')
    if (!DECOY_EXPECTATIONS.has(/** @type {string} */ (spec.expectation)))
      fail('a decoy needs expectation "not-flagged" or "known-false-positive"')
    if (spec.expectation === 'known-false-positive' && typeof spec.finding !== 'string')
      fail('a known false positive must cite its finding')
  }
  return problems
}

/**
 * @param {string} catalogueDir
 * @returns {Promise<Spec[]>}
 */
export async function loadSpecs(catalogueDir) {
  const files = (await readdir(catalogueDir))
    .filter((name) => name.endsWith('.json') && name !== 'catalogue.json')
    .sort()
  /** @type {string[]} */
  const problems = []
  /** @type {Spec[]} */
  const specs = []
  for (const fileName of files) {
    const path = join(catalogueDir, fileName)
    const parsed = JSON.parse(await readFile(path, 'utf8'))
    const specProblems = validateSpec(parsed, fileName)
    if (specProblems.length > 0) problems.push(...specProblems)
    else specs.push({ ...parsed, path })
  }
  if (problems.length > 0) throw new Error(`Invalid catalogue:\n${problems.join('\n')}`)
  return specs
}

/**
 * Applies edits to a file map, requiring each `find` to occur exactly once so a drifted source fails loudly.
 * @param {Map<string, string>} sources project-relative path to contents
 * @param {Edit[]} edits
 */
export function applyEdits(sources, edits) {
  for (const edit of edits) {
    const current = sources.get(edit.file)
    if (current === undefined) throw new Error(`referenceFix targets missing file ${edit.file}`)
    const first = current.indexOf(edit.find)
    if (first === -1)
      throw new Error(
        `referenceFix find text not found in ${edit.file}: ${JSON.stringify(edit.find.slice(0, 80))}`,
      )
    if (current.indexOf(edit.find, first + 1) !== -1)
      throw new Error(
        `referenceFix find text is ambiguous in ${edit.file}: ${JSON.stringify(edit.find.slice(0, 80))}`,
      )
    sources.set(
      edit.file,
      current.slice(0, first) + edit.replace + current.slice(first + edit.find.length),
    )
  }
  return sources
}

/**
 * Reads every file `edits` touch under `dir` and returns their contents with the edits applied.
 * @param {string} dir
 * @param {Edit[]} edits
 */
export async function readEditedSources(dir, edits) {
  /** @type {Map<string, string>} */
  const sources = new Map()
  for (const edit of edits) {
    if (!sources.has(edit.file))
      sources.set(edit.file, await readFile(join(dir, edit.file), 'utf8'))
  }
  return applyEdits(sources, edits)
}
