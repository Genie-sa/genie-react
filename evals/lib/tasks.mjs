import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { componentNames, extractAnswer, gradeAnswer } from './grade.mjs'

/**
 * @typedef {import('./grade.mjs').Answer} Answer
 * @typedef {import('./grade.mjs').Truth} Truth
 * @typedef {{ file: string, find: string, replace: string }} Edit
 * @typedef {{ component: string, maxUpdates: number }} RenderAssertion
 * @typedef {{ selector: string, includes: string }} TextAssertion
 * @typedef {{
 *   steps: string[][],
 *   settleMs?: number,
 *   renders?: RenderAssertion,
 *   text?: TextAssertion,
 *   noCaughtErrors?: boolean,
 * }} Probe
 * @typedef {{
 *   id: string,
 *   split: 'dev' | 'held-out',
 *   mode: 'diagnose' | 'fix',
 *   screen: string,
 *   prompt: string,
 *   truth: Truth,
 *   referenceAnswer: Answer,
 *   decoyAnswers: Answer[],
 *   referenceFix: Edit[],
 *   probe?: Probe,
 *   path: string,
 * }} Task
 */

const SPLITS = new Set(['dev', 'held-out'])
const MODES = new Set(['diagnose', 'fix'])
const TASK_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

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
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string')
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isAnswer(value) {
  return (
    isRecord(value) && ['component', 'cause', 'file'].every((key) => typeof value[key] === 'string')
  )
}

/**
 * Returns schema problems; an empty list means the task is well formed.
 * @param {unknown} task
 * @param {string} path
 * @returns {string[]}
 */
export function validateTask(task, path) {
  if (!isRecord(task)) return [`${path}: task must be a JSON object`]
  /** @type {string[]} */
  const problems = []
  const fail = (/** @type {string} */ message) => problems.push(`${path}: ${message}`)

  if (typeof task.id !== 'string' || !TASK_ID.test(task.id)) fail('id must be kebab-case')
  if (typeof task.id === 'string' && !path.endsWith(`${task.id}.json`)) {
    fail('file name must match id')
  }
  if (!SPLITS.has(String(task.split))) fail('split must be "dev" or "held-out"')
  if (!MODES.has(String(task.mode))) fail('mode must be "diagnose" or "fix"')
  if (typeof task.screen !== 'string' || task.screen === '') fail('screen is required')
  if (typeof task.prompt !== 'string' || task.prompt.length < 20) fail('prompt is too short')

  const { truth } = task
  if (!isRecord(truth)) fail('truth is required')
  else {
    if (!isStringList(truth.components)) fail('truth.components must list component names')
    else {
      for (const name of truth.components) {
        if (componentNames(name).join() !== name) {
          fail(`truth.components entry "${name}" must be a multi-word PascalCase or useX name`)
        }
      }
    }
    if (!isStringList(truth.files)) fail('truth.files must list project-relative paths')
    if (!isStringList(truth.causePatterns)) fail('truth.causePatterns must list regex sources')
    else {
      for (const pattern of truth.causePatterns) {
        try {
          new RegExp(pattern, 'i')
        } catch {
          fail(`truth.causePatterns has an invalid regex: ${pattern}`)
        }
      }
    }
    if (typeof truth.summary !== 'string') fail('truth.summary is required')
  }

  if (!isAnswer(task.referenceAnswer)) fail('referenceAnswer needs component, cause and file')
  if (!Array.isArray(task.decoyAnswers) || task.decoyAnswers.length === 0) {
    fail('decoyAnswers must list plausible wrong answers')
  } else if (!task.decoyAnswers.every(isAnswer)) {
    fail('each decoyAnswers entry needs component, cause and file')
  }

  const { referenceFix } = task
  if (
    !Array.isArray(referenceFix) ||
    referenceFix.length === 0 ||
    !referenceFix.every(
      (edit) =>
        isRecord(edit) &&
        typeof edit.file === 'string' &&
        typeof edit.find === 'string' &&
        typeof edit.replace === 'string',
    )
  ) {
    fail('referenceFix must list { file, find, replace } edits')
  }

  if (task.mode === 'fix' && !isRecord(task.probe)) fail('fix tasks need a runtime probe')
  if (task.probe !== undefined) problems.push(...validateProbe(task.probe, path))
  return problems
}

/**
 * @param {unknown} probe
 * @param {string} path
 * @returns {string[]}
 */
function validateProbe(probe, path) {
  if (!isRecord(probe)) return [`${path}: probe must be an object`]
  /** @type {string[]} */
  const problems = []
  if (!Array.isArray(probe.steps) || !probe.steps.every(isStringList)) {
    problems.push(`${path}: probe.steps must be agent-browser argument lists`)
  }
  const { renders, text } = probe
  if (!renders && !text && probe.noCaughtErrors !== true) {
    problems.push(`${path}: probe needs renders, text or noCaughtErrors`)
  }
  if (
    renders !== undefined &&
    !(
      isRecord(renders) &&
      typeof renders.component === 'string' &&
      Number.isInteger(renders.maxUpdates)
    )
  ) {
    problems.push(`${path}: probe.renders needs component and integer maxUpdates`)
  }
  if (
    text !== undefined &&
    !(isRecord(text) && typeof text.selector === 'string' && typeof text.includes === 'string')
  ) {
    problems.push(`${path}: probe.text needs selector and includes`)
  }
  return problems
}

/**
 * @param {string} directory
 * @returns {Promise<{ tasks: Task[], problems: string[] }>}
 */
export async function loadTasks(directory) {
  const files = (await readdir(directory)).filter((name) => name.endsWith('.json')).sort()
  /** @type {Task[]} */
  const tasks = []
  /** @type {string[]} */
  const problems = []
  for (const name of files) {
    const path = join(directory, name)
    let parsed
    try {
      parsed = JSON.parse(await readFile(path, 'utf8'))
    } catch (error) {
      problems.push(`${path}: invalid JSON (${error instanceof Error ? error.message : error})`)
      continue
    }
    const taskProblems = validateTask(parsed, path)
    problems.push(...taskProblems)
    if (taskProblems.length === 0) tasks.push({ ...parsed, path })
  }
  const seen = new Set()
  for (const task of tasks) {
    if (seen.has(task.id)) problems.push(`${task.path}: duplicate id ${task.id}`)
    seen.add(task.id)
  }
  return { tasks, problems }
}

/**
 * @param {Task[]} tasks
 * @param {{ ids: string[], split: 'dev' | 'held-out' | 'all' }} filter
 * @returns {Task[]}
 */
export function selectTasks(tasks, { ids, split }) {
  if (ids.length > 0) {
    const unknown = ids.filter((id) => !tasks.some((task) => task.id === id))
    if (unknown.length > 0) throw new Error(`Unknown task id: ${unknown.join(', ')}`)
    return tasks.filter((task) => ids.includes(task.id))
  }
  return split === 'all' ? tasks : tasks.filter((task) => task.split === split)
}

/**
 * Checks a task against the fixture source: its screen exists, truth files exist, the reference
 * answer passes, every decoy fails, and each reference edit matches exactly once.
 * @param {Task} task
 * @param {string} fixtureRoot
 * @returns {Promise<string[]>}
 */
export async function checkTaskAgainstFixture(task, fixtureRoot) {
  /** @type {string[]} */
  const problems = []
  const app = await readFile(join(fixtureRoot, 'src/App.tsx'), 'utf8')
  if (!new RegExp(`\\b${task.screen}:`).test(app)) {
    problems.push(`${task.id}: screen "${task.screen}" is not registered in App.tsx`)
  }
  for (const file of task.truth.files) {
    if ((await readFile(join(fixtureRoot, file), 'utf8').catch(() => null)) === null) {
      problems.push(`${task.id}: truth file ${file} does not exist`)
    }
  }
  const fenced = `Done.\n\n\`\`\`json\n${JSON.stringify(task.referenceAnswer)}\n\`\`\``
  const reference = gradeAnswer(extractAnswer(fenced), task.truth)
  if (!reference.pass) {
    problems.push(`${task.id}: reference answer fails: ${JSON.stringify(reference.checks)}`)
  }
  for (const decoy of task.decoyAnswers) {
    if (gradeAnswer(decoy, task.truth).pass) {
      problems.push(`${task.id}: decoy answer passes: ${JSON.stringify(decoy)}`)
    }
  }
  for (const { file, find } of task.referenceFix) {
    const source = await readFile(join(fixtureRoot, file), 'utf8').catch(() => '')
    const matches = source.split(find).length - 1
    if (matches !== 1) {
      problems.push(`${task.id}: reference edit in ${file} matches ${matches} times, expected 1`)
    }
  }
  return problems
}
