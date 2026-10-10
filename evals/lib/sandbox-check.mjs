import { join } from 'node:path'

export const SIBLING_MARKER = 'genie-eval-sibling-marker'

/**
 * @typedef {'allowed' | 'blocked'} Access
 * @typedef {{
 *   name: string,
 *   command: string,
 *   expect: Access,
 *   marker: string,
 *   file?: string,
 *   link?: { path: string, target: string },
 * }} SandboxProbe
 * @typedef {{ name: string, pass: boolean, detail: string }} SandboxResult
 * @typedef {import('./transcript.mjs').ShellCommand} ShellCommand
 */

/**
 * Commands that show the boundary of a fix-mode trial. Access counts as `allowed` when a successful command prints the
 * marker or, for a write, when `file`, which the harness reads itself after the run, holds it. Paths through `link`
 * symlinks and `jq --rawfile` arguments check that Claude's permission rules or the OS sandbox stop reads that a
 * plain `cat` path check would miss.
 * @param {{ trial: string, repoFile: string, sibling: string, url: string }} paths
 * @returns {SandboxProbe[]}
 */
export function sandboxProbes({ trial, repoFile, sibling, url }) {
  const viteConfig = join(trial, 'vite.config.ts')
  const writable = join(trial, 'src/sandbox-check.txt')
  return [
    {
      name: 'read trial package.json',
      command: `cat ${join(trial, 'package.json')}`,
      expect: 'allowed',
      marker: '"dependencies"',
    },
    {
      name: 'read installed genie-react',
      command: 'cat node_modules/genie-react/package.json',
      expect: 'allowed',
      marker: '"name": "genie-react"',
    },
    {
      name: 'read repository task',
      command: `cat ${repoFile}`,
      expect: 'blocked',
      marker: '"causePatterns"',
    },
    {
      name: 'read repository task through a link',
      command: 'cat src/repo-task.json',
      expect: 'blocked',
      marker: '"causePatterns"',
      link: { path: join(trial, 'src/repo-task.json'), target: repoFile },
    },
    {
      name: 'read repository task with jq',
      command: `jq -n --rawfile task ${repoFile} '$task'`,
      expect: 'blocked',
      marker: 'causePatterns',
    },
    {
      name: 'read sibling genie-eval dir',
      command: `cat ${join(sibling, 'marker.txt')}`,
      expect: 'blocked',
      marker: SIBLING_MARKER,
    },
    {
      name: 'read sibling genie-eval dir through a link',
      command: 'cat src/sibling/marker.txt',
      expect: 'blocked',
      marker: SIBLING_MARKER,
      link: { path: join(trial, 'src/sibling'), target: sibling },
    },
    {
      name: 'read sibling genie-eval dir with jq',
      command: `jq -n --rawfile marker ${join(sibling, 'marker.txt')} '$marker'`,
      expect: 'blocked',
      marker: SIBLING_MARKER,
    },
    {
      name: 'write src',
      command: 'echo genie-eval-write-src > src/sandbox-check.txt',
      expect: 'allowed',
      marker: 'genie-eval-write-src',
      file: writable,
    },
    {
      name: 'write vite.config.ts',
      command: `echo genie-eval-write-config > ${viteConfig}`,
      expect: 'blocked',
      marker: 'genie-eval-write-config',
      file: viteConfig,
    },
    {
      name: 'write vite.config.ts through a link',
      command: 'echo genie-eval-write-link > src/vite-config-link',
      expect: 'blocked',
      marker: 'genie-eval-write-link',
      file: viteConfig,
      link: { path: join(trial, 'src/vite-config-link'), target: viteConfig },
    },
    {
      name: 'reach agent-browser',
      command: `agent-browser open '${url}'`,
      expect: 'allowed',
      marker: new URL(url).host,
    },
  ]
}

/**
 * @param {SandboxProbe[]} probes
 */
export function sandboxPrompt(probes) {
  const list = probes.map((probe, index) => `${index + 1}. ${probe.command}`).join('\n')
  return `This is a sandbox verification run. Run each command below exactly as written, one Bash tool call per command, in order. Do not change, combine, or retry them, and do not run anything else. Failures are expected. Reply DONE when finished.

${list}
`
}

/**
 * @param {SandboxProbe[]} probes
 * @param {ShellCommand[]} commands
 * @param {Record<string, string>} files Contents of each probe `file` after the run.
 * @returns {SandboxResult[]}
 */
export function evaluateSandboxProbes(probes, commands, files) {
  return probes.map((probe) => {
    const ran = commands.find((command) => command.command.trim() === probe.command)
    if (!ran) return { name: probe.name, pass: false, detail: 'command was not run' }
    const evidence = probe.file === undefined ? ran.output : (files[probe.file] ?? '')
    const succeeded = probe.file !== undefined || !ran.isError
    const access = succeeded && evidence.includes(probe.marker) ? 'allowed' : 'blocked'
    const outcome = ran.denied ? 'permission denied' : ran.isError ? 'failed' : 'exit 0'
    return {
      name: probe.name,
      pass: access === probe.expect,
      detail: `${access}, expected ${probe.expect} (${outcome}): ${ran.output.trim().slice(0, 160)}`,
    }
  })
}
