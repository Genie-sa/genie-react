/** StyleX provenance lives on the DOM, not the fiber: `data-style-src` (debug) holds one `file:line` per applied stylex.create() object in stylex.props() order — the style key's line, later wins conflicts; dev marker classes (`Card__styles.card`, `Card__card` when unassigned, `theme__dark` for createTheme, which has no data-style-src) name each object in the same order; atomic classes (`x1e2nbdu`, or `borderColor-x1e2nbdu` with enableDebugClassNames) resolve to declarations through the same-origin CSSOM. */

export interface StyleSourceRef {
  file: string
  line: number | null
  /** Package-name prefix StyleX prepends to the path (`@scope/app:src/x.tsx`); null when absent. */
  package: string | null
}

export interface StyleObjectRef {
  /** `styles.card` from the dev marker class, when the app emits one; null with data-style-src alone. */
  name: string | null
  package: string | null
  /** Null when the app emits marker classes but no data-style-src. */
  file: string | null
  line: number | null
}

export interface StyleDeclaration {
  property: string
  value: string
  /** Pseudo / at-rule condition the declaration applies under (`:hover`, `@media (min-width: 48rem)`); null for unconditional. */
  condition: string | null
  className: string
  /** CSS custom properties the value reads via var() — StyleX tokens — with their current computed values. */
  tokens: StyleToken[]
}

export interface StyleToken {
  variable: string
  value: string | null
}

export interface DynamicStyleValue {
  variable: string
  value: string
}

export interface ElementStyleInfo {
  styleObjects: StyleObjectRef[]
  declarations: StyleDeclaration[]
  /** Runtime values StyleX style functions write to the inline style attribute as custom properties. */
  dynamic: DynamicStyleValue[]
  /** Class names that matched no stylesheet rule and are not StyleX markers — external CSS, utilities, or a stylesheet we cannot read. */
  unresolvedClasses: string[]
}

export interface StyleProvenanceStatus {
  system: 'stylex' | 'none'
  styleSrc: boolean
  hint: string | null
}

// The first ':' separates StyleX's package-name prefix from the path (neither contains ':'), only the trailing `:line` is positional, and a dynamic style function stamps its source twice (marker + value object) so consecutive duplicates collapse.
export function parseStyleSources(raw: string | null): StyleSourceRef[] {
  if (!raw) return []
  const sources: StyleSourceRef[] = []
  let previous: string | null = null
  for (const part of raw.split(';')) {
    const entry = part.trim()
    if (!entry || entry === previous) continue
    previous = entry
    const lineMatch = entry.match(/^(.+):(\d+)$/)
    const location = lineMatch ? (lineMatch[1] as string) : entry
    const line = lineMatch ? Number(lineMatch[2]) : null
    const packageBoundary = location.indexOf(':')
    sources.push(
      packageBoundary > 0
        ? {
            package: location.slice(0, packageBoundary),
            file: location.slice(packageBoundary + 1),
            line,
          }
        : { package: null, file: location, line },
    )
  }
  return sources
}

// `Card__styles.card` (basename, `__`, variable, `.`, key): the dot is the unambiguous StyleX signature; without it (`Card__card`, `theme__dark`) the shape is also BEM's.
const KEYED_MARKER_CLASS = /^[\w-]+__[\w-]+\.[\w-]+$/
const BARE_MARKER_CLASS = /^[\w-]+__[\w-]+$/
// Atomic classes are a hash (`x1e2nbdu`), optionally prefixed by the property in debug mode (`borderColor-x1e2nbdu`).
const ATOMIC_CLASS = /^(?:[a-zA-Z]+-)?x[0-9a-z]{5,}$/

/** Compiler-generated class names are worthless as selectors: hashed, and reassigned whenever the style changes. */
export const isGeneratedClass = (className: string): boolean =>
  KEYED_MARKER_CLASS.test(className) || ATOMIC_CLASS.test(className)

const markerName = (className: string): string => className.slice(className.indexOf('__') + 2)

/** Marker classes on an element; bare `A__b` names count only when StyleX evidence rules out BEM. */
export function styleMarkerClasses(classes: string[], hasStyleSrc: boolean): string[] {
  const stylex = hasStyleSrc || classes.some((className) => ATOMIC_CLASS.test(className))
  return classes.filter(
    (className) =>
      KEYED_MARKER_CLASS.test(className) || (stylex && BARE_MARKER_CLASS.test(className)),
  )
}

/** Pair marker classes with data-style-src entries by position; both are emitted in stylex.props() order. */
export function styleObjectsFor(markers: string[], sources: StyleSourceRef[]): StyleObjectRef[] {
  // Theme markers carry no data-style-src, so when counts disagree the keyed `var.key` markers are the ones with sources.
  const paired =
    markers.length === sources.length
      ? markers
      : markers.filter((marker) => KEYED_MARKER_CLASS.test(marker))
  if (sources.length > 0) {
    return sources.map((source, index) => ({
      ...source,
      name: paired.length === sources.length ? markerName(paired[index] as string) : null,
    }))
  }
  return markers.map((marker) => ({
    name: markerName(marker),
    package: null,
    file: null,
    line: null,
  }))
}

// ── CSSOM lookup ─────────────────────────────────────────────────────────────

interface RuleEntry {
  classNames: string[]
  /** Selector to verify with element.matches() when the part has more than classes and pseudos (tags, combinators, `:not(.x)`); null for class-only parts. */
  matcher: string | null
  condition: string | null
  style: CSSStyleDeclaration
}

// Rule scanning is bounded so a huge Tailwind/vendor stylesheet cannot stall the main thread.
const MAX_RULES = 20_000

const CLASS_TOKEN = /\.((?:[\w-]|\\.)+)/g
// Without CSS layers, StyleX bumps specificity by repeating `:not(#\#)`; it carries no meaning for readers.
const SPECIFICITY_BUMP = /:not\(#\\#\)/g
// Trailing pseudo-classes/elements are conditions (`:hover`, `::before`, `:nth-child(2)`); ones selecting by class/id/attribute (`:not(.x)`) are structure.
const TRAILING_PSEUDOS = /((?:::?[\w-]+(?:\([^()]*\))?)+)$/
const STRUCTURAL_PSEUDO_ARG = /[.#[]/

const unescapeClass = (token: string): string => token.replace(/\\(.)/g, '$1')

function splitSelectorList(selectorText: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < selectorText.length; i++) {
    const char = selectorText[i]
    if (char === '(') depth += 1
    else if (char === ')') depth -= 1
    else if (char === ',' && depth === 0) {
      parts.push(selectorText.slice(start, i))
      start = i + 1
    }
  }
  parts.push(selectorText.slice(start))
  return parts.map((part) => part.trim()).filter(Boolean)
}

// One entry per selector-list part; StyleX repeats the class once per nested at-rule (`.x1.x1` under @media), so class names are deduplicated.
function ruleEntries(rule: CSSStyleRule, atRuleConditions: string[]): RuleEntry[] {
  const entries: RuleEntry[] = []
  for (const part of splitSelectorList(rule.selectorText.replace(SPECIFICITY_BUMP, ''))) {
    const classNames = Array.from(
      new Set(Array.from(part.matchAll(CLASS_TOKEN), (match) => unescapeClass(match[1] as string))),
    )
    if (classNames.length === 0) continue
    const trailing = part.match(TRAILING_PSEUDOS)?.[1] ?? ''
    const pseudo = STRUCTURAL_PSEUDO_ARG.test(trailing) ? '' : trailing
    const structural = part.slice(0, part.length - pseudo.length)
    const conditions = [...atRuleConditions, pseudo].filter(Boolean)
    entries.push({
      classNames,
      matcher: structural.replace(CLASS_TOKEN, '').trim() === '' ? null : structural,
      condition: conditions.length ? conditions.join(' ') : null,
      style: rule.style,
    })
  }
  return entries
}

const safeMatches = (el: Element, selector: string): boolean => {
  try {
    return typeof el.matches === 'function' && el.matches(selector)
  } catch {
    return false
  }
}

// Duck-typed on purpose: the CSSOM constructors are not globals in every runtime that has a document.
const isStyleRule = (rule: CSSRule): rule is CSSStyleRule =>
  typeof (rule as CSSStyleRule).selectorText === 'string'

const isGroupingRule = (rule: CSSRule): rule is CSSGroupingRule =>
  typeof (rule as CSSGroupingRule).cssRules === 'object' &&
  (rule as CSSGroupingRule).cssRules !== null

const conditionOf = (rule: CSSRule): string | null => {
  const conditionText = (rule as CSSConditionRule).conditionText
  if (typeof conditionText !== 'string') return null
  const keyword = 'media' in rule ? '@media' : 'containerName' in rule ? '@container' : '@supports'
  return `${keyword} ${conditionText}`
}

/** Index the readable rules that select any of `classes`, keyed by class name; other rules are skipped before any parsing. Disabled and cross-origin sheets are skipped. */
export function indexStyleRules(
  doc: Document,
  classes: ReadonlySet<string>,
): Map<string, RuleEntry[]> {
  const index = new Map<string, RuleEntry[]>()
  let scanned = 0
  const visit = (rules: CSSRuleList, atRuleConditions: string[]): void => {
    for (const rule of Array.from(rules)) {
      if (scanned++ >= MAX_RULES) return
      if (isStyleRule(rule)) {
        if (!rule.selectorText.includes('.')) continue
        for (const entry of ruleEntries(rule, atRuleConditions)) {
          if (!entry.classNames.some((className) => classes.has(className))) continue
          for (const className of entry.classNames) {
            const list = index.get(className)
            if (list) list.push(entry)
            else index.set(className, [entry])
          }
        }
      } else if (isGroupingRule(rule)) {
        const condition = conditionOf(rule)
        visit(rule.cssRules, condition ? [...atRuleConditions, condition] : atRuleConditions)
      }
    }
  }
  for (const sheet of Array.from(doc.styleSheets)) {
    if (sheet.disabled) continue
    let rules: CSSRuleList
    try {
      rules = sheet.cssRules
    } catch {
      continue
    }
    visit(rules, [])
  }
  return index
}

const VAR_REFERENCE = /var\((--[\w-]+)/g

// getComputedStyle forces style resolution, so it runs only for values that read a variable.
function tokensIn(value: string, computed: () => CSSStyleDeclaration | null): StyleToken[] {
  if (!value.includes('var(')) return []
  const tokens: StyleToken[] = []
  for (const match of value.matchAll(VAR_REFERENCE)) {
    const variable = match[1] as string
    const resolved = computed()?.getPropertyValue(variable).trim()
    tokens.push({ variable, value: resolved || null })
  }
  return tokens
}

// `cssText` keeps shorthands as authored (`border-color: red`); iterating the declaration expands them into every longhand — four lines of noise per border property.
function authoredDeclarations(cssText: string): Array<[string, string]> {
  const declarations: Array<[string, string]> = []
  for (const part of cssText.split(';')) {
    const separator = part.indexOf(':')
    if (separator === -1) continue
    declarations.push([part.slice(0, separator).trim(), part.slice(separator + 1).trim()])
  }
  return declarations
}

function dynamicValues(el: Element): DynamicStyleValue[] {
  const inline = (el as HTMLElement).style
  if (!inline) return []
  const values: DynamicStyleValue[] = []
  for (let i = 0; i < inline.length; i++) {
    const property = inline.item(i)
    if (property.startsWith('--')) {
      values.push({ variable: property, value: inline.getPropertyValue(property).trim() })
    }
  }
  return values
}

/** Everything the DOM knows about one element's styling: which style objects, from where, and what CSS won. */
export function describeElementStyles(
  el: Element,
  index: Map<string, RuleEntry[]>,
): ElementStyleInfo {
  const classes = Array.from(el.classList)
  const classSet = new Set(classes)
  const sources = parseStyleSources(el.getAttribute?.('data-style-src') ?? null)
  const markers = styleMarkerClasses(classes, sources.length > 0)
  const markerSet = new Set(markers)
  let computed: CSSStyleDeclaration | null | undefined
  const computedStyle = (): CSSStyleDeclaration | null => {
    if (computed === undefined) {
      const view = el.ownerDocument.defaultView
      computed = view ? view.getComputedStyle(el) : null
    }
    return computed
  }

  const declarations: StyleDeclaration[] = []
  const unresolvedClasses: string[] = []
  for (const className of classes) {
    if (markerSet.has(className)) continue
    const entries = index.get(className)
    if (!entries) {
      unresolvedClasses.push(className)
      continue
    }
    for (const entry of entries) {
      // Class-only parts apply when every class is present (`.a.b`); anything structural is asked of the element itself.
      const applies =
        entry.matcher === null
          ? entry.classNames.every((name) => classSet.has(name))
          : safeMatches(el, entry.matcher)
      if (!applies) continue
      for (const [property, value] of authoredDeclarations(entry.style.cssText)) {
        declarations.push({
          property,
          value,
          condition: entry.condition,
          className,
          tokens: tokensIn(value, computedStyle),
        })
      }
    }
  }

  return {
    styleObjects: styleObjectsFor(markers, sources),
    declarations,
    dynamic: dynamicValues(el),
    unresolvedClasses,
  }
}

/** What the app emits, and the one config change that would unlock more — so an empty result explains itself. */
export function styleProvenanceStatus(infos: ElementStyleInfo[]): StyleProvenanceStatus {
  const objects = infos.flatMap((info) => info.styleObjects)
  const styleSrc = objects.some((ref) => ref.file !== null)
  if (objects.length === 0) {
    return {
      system: 'none',
      styleSrc: false,
      hint: 'No StyleX provenance on these elements. Set `dev: true` and `debug: true` on the StyleX bundler plugin (@stylexjs/unplugin, babel-plugin) to emit data-style-src.',
    }
  }
  return {
    system: 'stylex',
    styleSrc,
    hint: styleSrc
      ? null
      : 'StyleX marker classes found but no data-style-src: set `debug: true` on the StyleX bundler plugin to get file:line for each style object.',
  }
}
