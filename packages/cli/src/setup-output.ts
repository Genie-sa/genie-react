import { GENIE_CLIENT_PATH, GENIE_DEFAULT_HUB_PORT } from 'genie-react/protocol'
import { SKILL_PATH_CONFLICT } from './agent-skill'
import { writeJson } from './cli-output'
import { type InitOptions, initNextCommands, type RootRouteOutcome, runInit } from './index'
import { genieCommand, packageManagerCommands } from './package-manager'

export interface InitCommandOptions extends Omit<InitOptions, 'logger'> {
  maxBytes?: number
}

export function runInitCommand(options: InitCommandOptions = {}): number {
  const cwd = options.cwd ?? process.cwd()
  try {
    const result = runInit({ ...options, logger: { info() {}, error() {} } })
    const outcome = (kind: string, item: RootRouteOutcome) => ({
      kind,
      status:
        item.action === 'edit'
          ? result.dryRun
            ? 'planned'
            : 'applied'
          : item.action === 'skip'
            ? 'skipped'
            : item.action,
      ...('path' in item ? { path: item.path } : {}),
      ...('reason' in item ? { reason: item.reason } : {}),
    })
    const artifacts = [
      outcome('vite_config', result.viteConfig),
      outcome(result.framework === 'nextjs' ? 'next_layout' : 'root_route', result.rootRoute),
      ...(result.instrumentation ? [outcome('instrumentation', result.instrumentation)] : []),
      ...result.artifacts,
    ]
    const universal = result.framework === 'unknown' && result.viteConfig.action === 'missing'
    if (!universal && result.framework !== 'nextjs' && result.rootRoute.action === 'skip') {
      const root = artifacts.find(({ kind }) => kind === 'root_route')
      if (root) {
        root.status = 'manual'
        root.reason = 'Render Genie near the app root in development to expose collector tools.'
      }
    }
    const manual = artifacts.some(({ status }) => status === 'manual' || status === 'missing')
    const manualSteps = artifacts
      .filter(
        ({ kind, status }) =>
          (status === 'manual' || status === 'missing') && !(universal && kind === 'vite_config'),
      )
      .map(({ kind, reason, path }) => ({
        kind,
        ...(path ? { path } : {}),
        ...(kind === 'vite_config'
          ? { module: 'genie-react/vite', export: 'genie', placement: 'Vite plugins array' }
          : {}),
        ...(kind === 'root_route'
          ? {
              module: 'genie-react',
              export: 'Genie',
              placement: 'Render near the app root in development only',
            }
          : {}),
        ...(kind === 'next_layout'
          ? {
              module: 'genie-react/next',
              export: 'GenieScript',
              placement: 'Render inside the root layout body',
            }
          : {}),
        ...(kind === 'instrumentation'
          ? {
              module: 'genie-react/next',
              export: 'registerGenie',
              placement:
                'Call from register() only when NODE_ENV is not production and NEXT_RUNTIME is nodejs',
            }
          : {}),
        ...(kind === 'agent_skill' && reason === 'bundled_skill_missing'
          ? { next: installCliCommand(cwd) }
          : {}),
        ...(kind === 'agent_skill' && reason === SKILL_PATH_CONFLICT
          ? { placement: 'Remove the conflicting path, then rerun init' }
          : {}),
      }))
    writeJson(
      {
        schemaVersion: '1.0',
        status: result.ok ? 'ok' : 'action_required',
        reason: result.ok
          ? result.dryRun
            ? 'setup_planned'
            : 'setup_completed'
          : 'manual_setup_required',
        message: result.ok
          ? 'Setup changes are recorded in artifacts.'
          : 'Complete the manual setup steps and run doctor.',
        userActionRequired: !result.ok || manual || universal,
        data: {
          framework: result.framework,
          dryRun: result.dryRun,
          artifacts,
          manualSteps,
          commands: initNextCommands(cwd, result.framework),
          ...(universal
            ? {
                integration: {
                  module: 'genie-react/next',
                  export: 'GenieScript',
                  scriptUrl: `http://localhost:${GENIE_DEFAULT_HUB_PORT}${GENIE_CLIENT_PATH}`,
                  developmentOnly: true,
                },
              }
            : {}),
        },
        next: genieCommand([universal ? 'hub' : 'doctor'], cwd),
      },
      options.maxBytes,
    )
    return result.ok ? 0 : 1
  } catch {
    writeJson(
      {
        schemaVersion: '1.0',
        status: 'error',
        reason: 'setup_failed',
        message:
          'Failed to apply local setup. Check file permissions and inspect the current setup before retrying.',
        userActionRequired: true,
        data: { changesMayHaveApplied: !options.dryRun },
        next: genieCommand(['init', '--dry-run'], cwd),
      },
      options.maxBytes,
    )
    return 1
  }
}

function installCliCommand(cwd: string) {
  const argv = [...packageManagerCommands(cwd).add, '@genie-react/cli']
  return { command: argv.join(' '), argv }
}
