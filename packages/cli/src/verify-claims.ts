import type {
  VerifyCause,
  VerifyClaimInput,
  VerifyEffectTarget,
  VerifyTarget,
} from 'genie-react/protocol'
import { editDistance } from './tool-output'

/** A claim the DSL rejected; `message` names the word position and what was expected, never the text the caller typed. */
export class ClaimSyntaxError extends Error {
  constructor(
    message: string,
    readonly position: number,
    readonly suggestion?: string,
  ) {
    super(message)
  }
}

const CLAIM_KEYWORDS = ['render', 'effect', 'boundaries'] as const
const LATER_KINDS = new Set(['query', 'route', 'suspense', 'budget'])
const BOUND_KEYWORDS = ['max', 'min', 'only'] as const
const EFFECT_KEYWORDS = ['max', 'settles'] as const
const BOUNDARY_KEYWORDS = ['clean', 'clean-at-end'] as const
const MODIFIER_KEYWORDS = ['counting', 'allow-remount'] as const
const NAMED_CAUSES = new Set(['props', 'state', 'context', 'query'])
const PLAIN_CAUSES = new Set(['mount', 'children', 'router', 'parent', 'external-store'])
const TARGET = /^([^\s@[\]#,]+)(?:@([^\s@[\]#,]+))?(?:\[key=([^\]\s]*)\])?(?:#(\d{1,2}))?$/
const COUNT = /^(0|[1-9]\d{0,5})$/
const SAFE_WORD = /^[a-z][a-z-]{0,23}$/

/** The keyword nearest to what was typed, within two edits; only offered when the typed word is a plain short keyword-like word. */
function nearest(typed: string | undefined, options: readonly string[]): string | undefined {
  if (typed === undefined || !SAFE_WORD.test(typed)) return undefined
  let best: { option: string; distance: number } | undefined
  for (const option of options) {
    const distance = editDistance(typed, option)
    if (distance <= 2 && (best === undefined || distance < best.distance))
      best = { option, distance }
  }
  return best?.option
}

function expected(
  position: number,
  what: string,
  typed: string | undefined,
  options: readonly string[],
): never {
  const suggestion = nearest(typed, options)
  throw new ClaimSyntaxError(
    `Word ${position} must be ${what}${suggestion ? `; did you mean ${suggestion}?` : '.'}`,
    position,
    suggestion,
  )
}

function parseTarget(
  word: string | undefined,
  position: number,
  allowEffectIndex: boolean,
): VerifyEffectTarget {
  const match = word === undefined ? null : TARGET.exec(word)
  if (!match) {
    throw new ClaimSyntaxError(
      `Word ${position} must be a component target: Name, Name@src/file.tsx, or Name[key=value]${allowEffectIndex ? ', with an optional #index' : ''}.`,
      position,
    )
  }
  const [, component, source, key, effectIndex] = match
  if (effectIndex !== undefined && !allowEffectIndex) {
    throw new ClaimSyntaxError(`Word ${position}: #index applies only to effect claims.`, position)
  }
  if (/^\d+$/.test(component ?? '')) {
    throw new ClaimSyntaxError(
      `Word ${position}: a target is a component name, never a numeric component ID; IDs change on reload.`,
      position,
    )
  }
  return {
    component: component as string,
    ...(source === undefined ? {} : { source }),
    ...(key === undefined ? {} : { key }),
    ...(effectIndex === undefined ? {} : { effectIndex: Number(effectIndex) }),
  }
}

function parseCount(word: string | undefined, position: number): number {
  if (word === undefined || !COUNT.test(word)) {
    throw new ClaimSyntaxError(
      `Word ${position} must be a whole number of at most 100000.`,
      position,
    )
  }
  return Number(word)
}

/** State causes are named by hook slot, such as state[0] or reducer[1]; the slot alone names one. */
const STATE_SLOT = /^(?:state|reducer)\[\d{1,3}\]$/

function parseCause(text: string, position: number): VerifyCause {
  if (STATE_SLOT.test(text)) return { kind: 'state', name: text }
  const dot = text.indexOf('.')
  const kind = dot === -1 ? text : text.slice(0, dot)
  const name = dot === -1 ? undefined : text.slice(dot + 1)
  if (PLAIN_CAUSES.has(kind) && name === undefined) return { kind: kind as VerifyCause['kind'] }
  if (NAMED_CAUSES.has(kind) && (name === undefined || name.length > 0)) {
    return { kind: kind as VerifyCause['kind'], ...(name === undefined ? {} : { name }) }
  }
  return expected(
    position,
    'a cause: mount, children, router, or props, state, context or query with an optional .name',
    kind,
    [...PLAIN_CAUSES, ...NAMED_CAUSES],
  )
}

function parseRender(words: string[]): VerifyClaimInput {
  const target: VerifyTarget = parseTarget(words[1], 2, false)
  const bound = words[2]
  if (bound === 'only') {
    const list = words.slice(3).join('')
    if (list.length === 0)
      throw new ClaimSyntaxError('Word 4 must list allowed causes, separated by commas.', 4)
    return {
      kind: 'render-causes',
      target,
      allow: list.split(',').map((cause) => parseCause(cause, 4)),
    }
  }
  if (bound !== 'max' && bound !== 'min')
    return expected(3, 'max, min or only', bound, BOUND_KEYWORDS)
  const count = parseCount(words[3], 4)
  let counting: 'renders' | 'updates' = 'renders'
  let allowRemount = false
  for (let index = 4; index < words.length; index += 1) {
    const word = words[index]
    if (word === 'counting') {
      const unit = words[index + 1]
      if (unit !== 'renders' && unit !== 'updates')
        return expected(index + 2, 'renders or updates', unit, ['renders', 'updates'])
      counting = unit
      index += 1
    } else if (word === 'allow-remount') {
      allowRemount = true
    } else {
      return expected(index + 1, 'counting or allow-remount', word, MODIFIER_KEYWORDS)
    }
  }
  return {
    kind: 'renders',
    target,
    ...(bound === 'max' ? { max: count } : { min: count }),
    ...(counting === 'updates' ? { counting } : {}),
    ...(allowRemount ? { allowRemount } : {}),
  }
}

function parseEffect(words: string[]): VerifyClaimInput {
  const target = parseTarget(words[1], 2, true)
  const verb = words[2]
  if (verb === 'settles') {
    if (words.length > 3) throw new ClaimSyntaxError('Word 4: settles takes no further words.', 4)
    return { kind: 'effect-settles', target }
  }
  if (verb !== 'max') return expected(3, 'max or settles', verb, EFFECT_KEYWORDS)
  const max = parseCount(words[3], 4)
  if (words.length > 4)
    throw new ClaimSyntaxError('Word 5: an effect max claim takes no further words.', 5)
  return { kind: 'effect-runs', target, max }
}

function parseBoundaries(words: string[]): VerifyClaimInput {
  const scope = words[1]
  if (scope !== 'clean' && scope !== 'clean-at-end')
    return expected(2, 'clean or clean-at-end', scope, BOUNDARY_KEYWORDS)
  if (words.length > 2)
    throw new ClaimSyntaxError('Word 3: boundaries claims take no further words.', 3)
  return { kind: 'boundaries-clean', ...(scope === 'clean-at-end' ? { scope: 'end' } : {}) }
}

/** Parses one `--claim` value in the verify DSL into the claim JSON the hub accepts. */
export function parseClaim(text: string): VerifyClaimInput {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const [kind] = words
  if (kind !== undefined && LATER_KINDS.has(kind)) {
    throw new ClaimSyntaxError(
      `Word 1: ${kind} claims are not available in this release; use render, effect or boundaries.`,
      1,
    )
  }
  switch (kind) {
    case 'render':
      return parseRender(words)
    case 'effect':
      return parseEffect(words)
    case 'boundaries':
      return parseBoundaries(words)
    default:
      return expected(1, 'render, effect or boundaries', kind, CLAIM_KEYWORDS)
  }
}
