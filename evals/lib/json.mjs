const CLOSERS = /** @type {Record<string, string>} */ ({ '{': '}', '[': ']' })

/**
 * Returns the balanced JSON object or array text starting at `start`, skipping brackets inside strings.
 * @param {string} text
 * @param {number} start
 * @returns {string | null}
 */
export function balancedJson(text, start) {
  /** @type {string[]} */
  const expected = []
  let inString = false
  for (let index = start; index < text.length; index += 1) {
    const char = text[index] ?? ''
    if (inString) {
      if (char === '\\') index += 1
      else if (char === '"') inString = false
    } else if (char === '"') inString = true
    else if (char in CLOSERS) expected.push(CLOSERS[char] ?? '')
    else if (char === '}' || char === ']') {
      if (expected.pop() !== char) return null
      if (expected.length === 0) return text.slice(start, index + 1)
    }
  }
  return null
}

/**
 * Parses every top-level JSON object or array embedded in free text: JSONL, pretty-printed values, or values mixed with other output.
 * @param {string} text
 * @returns {unknown[]}
 */
export function parseJsonValues(text) {
  /** @type {unknown[]} */
  const values = []
  let index = 0
  while (index < text.length) {
    const candidate = (text[index] ?? '') in CLOSERS ? balancedJson(text, index) : null
    if (candidate) {
      try {
        values.push(JSON.parse(candidate))
        index += candidate.length
        continue
      } catch {}
    }
    index += 1
  }
  return values
}
