'use strict'

function createFaults() {
  let rules = []

  const matches = (rule, method, path) =>
    (!rule.method || rule.method.toUpperCase() === method) &&
    (rule.path.startsWith('^') ? new RegExp(rule.path).test(path) : path.startsWith(rule.path))

  return {
    list: () => rules.map((rule) => ({ ...rule })),
    replace(next) {
      rules = next.map((rule) => ({
        method: rule.method ?? null,
        path: rule.path,
        query: rule.query ?? null,
        latencyMs: rule.latencyMs ?? 0,
        status: rule.status ?? null,
        times: rule.times ?? null,
        hits: 0,
      }))
    },
    clear() {
      rules = []
    },
    take(method, path, searchParams) {
      const rule = rules.find(
        (candidate) =>
          matches(candidate, method, path) &&
          (candidate.times === null || candidate.hits < candidate.times) &&
          Object.entries(candidate.query ?? {}).every(
            ([name, value]) => searchParams.get(name) === value,
          ),
      )
      if (!rule) return null
      rule.hits += 1
      return rule
    },
  }
}

module.exports = { createFaults }
