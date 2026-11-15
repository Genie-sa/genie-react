import { z } from 'zod'

const MATCH_NAME_LIMIT = 20

export interface ComponentNameSelector {
  component?: string
  /** Absent means exact: a substring match is opt-in so `Checkout` never silently reads `CheckoutRow`. */
  exact?: boolean
}

export const componentSelectorInputShape = {
  component: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .optional()
    .describe(
      'Only the component with this exact display name (case-sensitive). Pass exact:false to match every name containing it, ignoring case.',
    ),
  exact: z
    .boolean()
    .default(true)
    .describe(
      'false matches component as a case-insensitive substring; check componentMatch.matchedNames, because the result can mix components.',
    ),
}

export const componentMatchSchema = z
  .object({
    component: z.string(),
    exact: z.boolean(),
    status: z
      .enum(['matched', 'ambiguous', 'no-match'])
      .describe(
        'matched: one display name matched. ambiguous: several display names matched and the result mixes their evidence. no-match: no evidence in this result carries the name, which does not prove the component is absent from the app.',
      ),
    matchedNames: z.array(z.string()).max(MATCH_NAME_LIMIT),
    matchedNameCount: z.number().int().nonnegative(),
    similarNames: z
      .array(z.string())
      .max(MATCH_NAME_LIMIT)
      .describe(
        'On no-match, names in the same evidence that contain component ignoring case; pass one of them, or exact:false.',
      ),
  })
  .describe('How component selected the evidence. Present only when component is set.')

export type ComponentMatch = z.output<typeof componentMatchSchema>

export function componentNameMatcher(selector: ComponentNameSelector): (name: string) => boolean {
  const { component } = selector
  if (component === undefined) return () => true
  if (selector.exact !== false) return (name) => name === component
  const needle = component.toLowerCase()
  return (name) => name.toLowerCase().includes(needle)
}

export function describeComponentMatch(
  selector: ComponentNameSelector & { component: string },
  names: Iterable<string>,
): ComponentMatch
export function describeComponentMatch(
  selector: ComponentNameSelector,
  names: Iterable<string>,
): ComponentMatch | undefined
export function describeComponentMatch(
  selector: ComponentNameSelector,
  names: Iterable<string>,
): ComponentMatch | undefined {
  const { component } = selector
  if (component === undefined) return undefined
  const matches = componentNameMatcher(selector)
  const needle = component.toLowerCase()
  const matched = new Set<string>()
  const similar = new Set<string>()
  for (const name of names) {
    if (matches(name)) matched.add(name)
    else if (name.toLowerCase().includes(needle)) similar.add(name)
  }
  const sorted = (values: Set<string>) => [...values].sort().slice(0, MATCH_NAME_LIMIT)
  return {
    component,
    exact: selector.exact !== false,
    status: matched.size === 0 ? 'no-match' : matched.size === 1 ? 'matched' : 'ambiguous',
    matchedNames: sorted(matched),
    matchedNameCount: matched.size,
    similarNames: matched.size === 0 ? sorted(similar) : [],
  }
}
