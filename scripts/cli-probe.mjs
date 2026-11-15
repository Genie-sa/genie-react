// Preloaded with `node --import` by the CLI benchmarks: records the CLI's phase marks, its stdout writes, and optionally every module it loads, then writes one JSON report to GENIE_CLI_PROBE_FILE at exit.
import { subscribe } from 'node:diagnostics_channel'
import { statSync, writeFileSync } from 'node:fs'
import * as nodeModule from 'node:module'
import { fileURLToPath } from 'node:url'

const reportFile = process.env.GENIE_CLI_PROBE_FILE
if (!reportFile) throw new Error('cli-probe: set GENIE_CLI_PROBE_FILE to the report path')

const probeStartedAt = performance.now()
const phases = []
subscribe('genie-react:cli-phase', (phase) => phases.push([phase, performance.now()]))

const stdout = { bytes: 0, writes: 0, lastWriteAt: null }
const write = process.stdout.write
process.stdout.write = function probedWrite(chunk, ...rest) {
  stdout.writes += 1
  stdout.bytes += typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.byteLength
  stdout.lastWriteAt = performance.now()
  return write.call(this, chunk, ...rest)
}

const modules = []
if (process.env.GENIE_CLI_PROBE_MODULES === '1') {
  if (typeof nodeModule.registerHooks !== 'function') {
    throw new Error(`cli-probe: module accounting needs module.registerHooks (Node >= 22.15)`)
  }
  nodeModule.registerHooks({
    load(url, context, nextLoad) {
      const result = nextLoad(url, context)
      if (url.startsWith('file:')) modules.push({ url, bytes: sourceBytes(url, result.source) })
      return result
    },
  })
}

function sourceBytes(url, source) {
  if (typeof source === 'string') return Buffer.byteLength(source)
  if (source) return source.byteLength
  return statSync(fileURLToPath(url)).size
}

process.on('exit', (code) => {
  const { nodeStart, v8Start, environment, bootstrapComplete } = performance.nodeTiming
  writeFileSync(
    reportFile,
    JSON.stringify({
      code,
      timeOrigin: performance.timeOrigin,
      node: { nodeStart, v8Start, environment, bootstrapComplete },
      probeStartedAt,
      exitAt: performance.now(),
      compileCacheDir: nodeModule.getCompileCacheDir?.() ?? null,
      phases,
      stdout,
      modules,
    }),
  )
})
