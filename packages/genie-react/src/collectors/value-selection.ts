import { z } from 'zod'
import { appValueSchema, dehydrate, readOwnPath } from '../protocol'

const SELECTION_MATCH_LIMIT = 20
const SELECTION_SCAN_LIMIT = 100_000

const pathSegmentsSchema = z.array(z.union([z.string(), z.number()]))

export const whereSchema = z
  .object({
    field: z
      .union([z.string(), pathSegmentsSchema.min(1)])
      .describe(
        'Field of each entry to compare, such as "id", or a path such as ["customer","id"].',
      ),
    equals: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  })
  .optional()
  .describe(
    'Select entries of the array, Map or object at `path` (or of the data) whose field equals this value, instead of reading them by index. Matches come back under `selection`, each with its full path for a follow-up read.',
  )

export const selectionSchema = z
  .object({
    matchCount: z.number().int().nonnegative(),
    scanned: z.number().int().nonnegative(),
    scanTruncated: z
      .boolean()
      .describe(`More than ${SELECTION_SCAN_LIMIT} entries; later ones were not compared.`),
    containerFound: z.boolean().describe('false: nothing iterable at `path`.'),
    matches: z
      .array(z.object({ path: pathSegmentsSchema, value: appValueSchema('The matched entry.') }))
      .describe(`First ${SELECTION_MATCH_LIMIT} matches, depth-bounded.`),
  })
  .optional()

export type Where = z.infer<typeof whereSchema>
export type Selection = z.infer<typeof selectionSchema>

function entriesOf(container: unknown): Array<[string | number, unknown]> | null {
  if (Array.isArray(container)) return container.map((value, index) => [index, value])
  if (container instanceof Map)
    return [...container.entries()].map(([key, value]) => [String(key), value])
  if (typeof container !== 'object' || container === null) return null
  return Object.keys(container).map((key) => [key, readOwnPath(container, [key]).value])
}

/** Finds entries by a field value without running app getters: an order by id in a list of thousands. */
export function selectEntries(
  data: unknown,
  path: Array<string | number> | undefined,
  where: NonNullable<Where>,
  depth: number,
): Selection {
  const base = path ?? []
  const container = readOwnPath(data, base)
  const entries = container.found ? entriesOf(container.value) : null
  if (!entries)
    return { matchCount: 0, scanned: 0, scanTruncated: false, containerFound: false, matches: [] }
  const field = typeof where.field === 'string' ? [where.field] : where.field
  const scanned = entries.slice(0, SELECTION_SCAN_LIMIT)
  const matches = scanned.filter(([, entry]) => {
    const read = readOwnPath(entry, field)
    return read.found && Object.is(read.value, where.equals)
  })
  return {
    matchCount: matches.length,
    scanned: scanned.length,
    scanTruncated: entries.length > scanned.length,
    containerFound: true,
    matches: matches.slice(0, SELECTION_MATCH_LIMIT).map(([key, entry]) => ({
      path: [...base, key],
      value: dehydrate(entry, { depth }),
    })),
  }
}
