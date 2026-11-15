#!/usr/bin/env node
const SPEC_RUNNER_APPS = new Set(['dashboard'])

const usesSpecRunner = process.argv.slice(2).some((argument) => SPEC_RUNNER_APPS.has(argument))
await import(usesSpecRunner ? './run-spec-probes.mjs' : './run-harness-probes.mjs')
