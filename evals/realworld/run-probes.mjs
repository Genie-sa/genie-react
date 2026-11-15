#!/usr/bin/env node
const RUNNERS = new Map([
  ['dashboard', './run-spec-probes.mjs'],
  ['storefront', './run-storefront-probes.mjs'],
])

const app = process.argv.slice(2).find((argument) => RUNNERS.has(argument))
await import(RUNNERS.get(app ?? '') ?? './run-harness-probes.mjs')
