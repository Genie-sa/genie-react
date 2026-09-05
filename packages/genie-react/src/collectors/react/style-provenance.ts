/**
 * StyleX style provenance for host elements, read from what its compiler leaves on the DOM in dev mode:
 *  - `data-style-src="pkg:src/Card.tsx:5; src/Theme.tsx:12"` — one entry per stylex.create() object
 *    applied via stylex.props(), in argument order (= conflict-resolution order, later wins); the line
 *    is that of the style key (`card: {`). Emitted with `debug: true`.
 *  - marker classes naming each applied object: `Card__styles.card`, or `Card__card` when create()
 *    is not assigned to a variable, and `theme__dark` for createTheme() (which has no data-style-src).
 *    Emitted with `dev: true`.
 *  - atomic classes (`x1e2nbdu`, or `borderColor-x1e2nbdu` with enableDebugClassNames) whose CSS
 *    rules live in a same-origin stylesheet, so the winning declaration per property is a CSSOM lookup.
 * None of this is on the fiber: stylex.props() has already merged everything into className.
 */

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

// StyleX prefixes the file with the owning package name; neither package names nor the paths that
// follow contain ':', so the first ':' is the boundary and only the trailing `:line` is positional.
// A dynamic style function stamps its source twice (marker object + value object), so consecutive
// duplicates collapse to one entry.
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

// `Card__styles.card`: basename, double underscore, variable name, dot, style key. The dot is the
// unambiguous StyleX signature; without it (`Card__card`, `theme__dark`) the shape is also BEM's.
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
  condition: string | null
  style: CSSStyleDeclaration
}

// Rule scanning is bounded so a huge Tailwind/vendor stylesheet cannot stall the main thread.
const MAX_RULES = 20_000

const CLASS_TOKEN = /\.((?:[\w-]|\\.)+)/g
// Without CSS layers, StyleX bumps specificity by repeating `:not(#\#)`; it carries no meaning for readers.
const SPECIFICITY_BUMP = /:not\(#\\#\)/g

const unescapeClass = (token: string): string => token.replace(/\\(.)/g, '$1')

// StyleX also repeats the class once per nested at-rule (`.x1.x1` under @media) for specificity.
function ruleEntry(rule: CSSStyleRule, atRuleConditions: string[]): RuleEntry | null {
  const selector = rule.selectorText.replace(SPECIFICITY_BUMP, '')
  const classNames = new Set<string>()
  let residue = selector
  for (const match of selector.matchAll(CLASS_TOKEN)) {
    classNames.add(unescapeClass(match[1] as string))
    residue = residue.replace(match[0], '')
  }
  if (classNames.size === 0) return null
  const pseudo = residue.trim()
  const parts = [...atRuleConditions, pseudo].filter(Boolean)
  return {
    classNames: Array.from(classNames),
    condition: parts.length ? parts.join(' ') : null,
    style: rule.style,
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

/** Index every class-selected rule the document can read, keyed by class name. Disabled and cross-origin sheets are skipped. */
export function indexStyleRules(doc: Document): Map<string, RuleEntry[]> {
  const index = new Map<string, RuleEntry[]>()
  let scanned = 0
  const visit = (rules: CSSRuleList, atRuleConditions: string[]): void => {
    for (const rule of Array.from(rules)) {
      if (scanned++ >= MAX_RULES) return
      if (isStyleRule(rule)) {
        const entry = ruleEntry(rule, atRuleConditions)
        if (!entry) continue
        for (const className of entry.classNames) {
          const list = index.get(className)
          if (list) list.push(entry)
          else index.set(className, [entry])
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

function tokensIn(value: string, computed: CSSStyleDeclaration | null): StyleToken[] {
  const tokens: StyleToken[] = []
  for (const match of value.matchAll(VAR_REFERENCE)) {
    const variable = match[1] as string
    const resolved = computed?.getPropertyValue(variable).trim()
    tokens.push({ variable, value: resolved || null })
  }
  return tokens
}

// `cssText` keeps shorthands as authored (`border-color: red`), whereas iterating the declaration
// expands them into every longhand — four lines of noise per border property.
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
  const sources = parseStyleSources(el.getAttribute?.('data-style-src') ?? null)
  const markers = styleMarkerClasses(classes, sources.length > 0)
  const view = el.ownerDocument.defaultView
  const computed = view ? view.getComputedStyle(el) : null

  const declarations: StyleDeclaration[] = []
  const unresolvedClasses: string[] = []
  for (const className of classes) {
    if (markers.includes(className)) continue
    const entries = index.get(className)
    if (!entries) {
      unresolvedClasses.push(className)
      continue
    }
    for (const entry of entries) {
      // Every class in the selector must be on the element for the rule to apply (`.a.b` compound selectors).
      if (!entry.classNames.every((name) => classes.includes(name))) continue
      for (const [property, value] of authoredDeclarations(entry.style.cssText)) {
        declarations.push({
          property,
          value,
          condition: entry.condition,
          className,
          tokens: tokensIn(value, computed),
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
