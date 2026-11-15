import { conflictRemedy, SKILL_PATH_CONFLICT } from './agent-skill'
import { writeEnvelope } from './cli-output'
import { type InitOptions, initNextCommands, type RootRouteOutcome, runInit } from './index'
import { genieCommand, packageManagerCommands } from './package-manager'
import { CLI_OUTPUT_SCHEMA_VERSION } from './schema-version'
import {
  CLIENT_MODULE,
  clientScriptUrl,
  clientWebSocketUrl,
  HOOK_MODULE,
  lateHookImports,
  misdirectedScriptTags,
  misdirectedTagFix,
  missingWiring,
  OTHER_WEB_GUIDE,
  type WebSetup,
} from './web-setup'

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
    const universal = result.webSetup
    const artifacts = [
      ...(universal
        ? [webClientArtifact(universal)]
        : [
            outcome('vite_config', result.viteConfig),
            outcome(result.framework === 'nextjs' ? 'next_layout' : 'root_route', result.rootRoute),
          ]),
      ...(result.instrumentation ? [outcome('instrumentation', result.instrumentation)] : []),
      ...result.artifacts,
    ]
    if (!universal && result.framework !== 'nextjs' && result.rootRoute.action === 'skip') {
      const root = artifacts.find(({ kind }) => kind === 'root_route')
      if (root) {
        root.status = 'manual'
        root.reason = 'Render Genie near the app root in development to expose collector tools.'
      }
    }
    const manual = artifacts.some(({ status }) => status === 'manual' || status === 'missing')
    const manualSteps = artifacts
      .filter(({ status }) => status === 'manual' || status === 'missing')
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
        ...(kind === 'client_setup' && universal ? clientSetupStep(universal) : {}),
        ...(kind === 'agent_skill' && reason === 'bundled_skill_missing'
          ? { next: installCliCommand(cwd) }
          : {}),
        ...(kind === 'agent_skill' && reason === SKILL_PATH_CONFLICT && path
          ? { placement: `${conflictRemedy(path)}, then rerun init` }
          : {}),
      }))
    if (universal) manualSteps.push(...webSetupFixes(universal))
    writeEnvelope(
      {
        schemaVersion: CLI_OUTPUT_SCHEMA_VERSION,
        status: result.ok ? 'ok' : 'action_required',
        reason: result.ok
          ? result.dryRun
            ? 'setup_planned'
            : 'setup_completed'
          : 'manual_setup_required',
        message: result.ok
          ? 'Setup changes are recorded in artifacts.'
          : 'Complete the manual setup steps and run doctor.',
        userActionRequired: !result.ok || manual || manualSteps.length > 0,
        data: {
          framework: result.framework,
          dryRun: result.dryRun,
          artifacts,
          manualSteps,
          commands: {
            ...initNextCommands(cwd, result.framework),
            ...(universal ? { hub: universal.hub.start } : {}),
          },
          ...(universal ? { integration: webIntegration(universal) } : {}),
        },
        next: universal
          ? universal.hub.portSource === 'running-hub'
            ? genieCommand(['doctor', '--live'], cwd)
            : universal.hub.start
          : genieCommand(['doctor'], cwd),
      },
      options.maxBytes,
    )
    return result.ok ? 0 : 1
  } catch {
    writeEnvelope(
      {
        schemaVersion: CLI_OUTPUT_SCHEMA_VERSION,
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

function webClientArtifact(setup: WebSetup) {
  const wiredFile = setup.scriptTags[0]?.file ?? setup.clientStarts[0]
  return {
    kind: 'client_setup',
    status: setup.wired ? 'already' : 'manual',
    ...(setup.wired && wiredFile ? { path: wiredFile } : {}),
    ...(setup.wired ? {} : { reason: missingWiring(setup) }),
  }
}

function clientSetupStep(setup: WebSetup) {
  return {
    placement:
      'Development only. Load one client: the script tag first in <head>, or genie-react/hook imported before React in the entry plus one createGenieClient.',
    scriptTag: `<script src="${clientScriptUrl(setup.hub.port)}"></script>`,
    hookModule: HOOK_MODULE,
    module: CLIENT_MODULE,
    export: 'createGenieClient',
    url: clientWebSocketUrl(setup.hub.port),
    guide: OTHER_WEB_GUIDE,
  }
}

function webSetupFixes(setup: WebSetup) {
  return [
    ...lateHookImports(setup).map(({ file }) => ({
      kind: 'hook_order',
      path: file,
      module: HOOK_MODULE,
      placement: 'Import it above every react and react-dom import in this file',
    })),
    ...misdirectedScriptTags(setup).map((tag) => ({
      kind: 'client_port',
      path: tag.file,
      placement: misdirectedTagFix(setup, tag),
    })),
  ]
}

function webIntegration(setup: WebSetup) {
  return {
    bundler: setup.bundler,
    hubPort: setup.hub.port,
    hubPortSource: setup.hub.portSource,
    scriptUrl: clientScriptUrl(setup.hub.port),
    websocketUrl: clientWebSocketUrl(setup.hub.port),
    hookModule: HOOK_MODULE,
    clientModule: CLIENT_MODULE,
    developmentOnly: true,
    guide: OTHER_WEB_GUIDE,
  }
}

function installCliCommand(cwd: string) {
  const argv = [...packageManagerCommands(cwd).add, '@genie-react/cli']
  return { command: argv.join(' '), argv }
}
