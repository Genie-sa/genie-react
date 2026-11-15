#!/usr/bin/env node
import { enableCompileCache } from 'node:module'
import { join } from 'node:path'
import { ensurePrivateDirectory, genieUserDirectory } from 'genie-react/hub/token'

/** Caches compiled code for the rest of the CLI in the private per-user directory, so later runs skip compiling it; NODE_COMPILE_CACHE and NODE_DISABLE_COMPILE_CACHE keep their Node meaning. */
function enableCliCompileCache(): void {
  if (process.env.NODE_COMPILE_CACHE || process.env.NODE_DISABLE_COMPILE_CACHE) return
  try {
    const directory = genieUserDirectory()
    ensurePrivateDirectory(directory)
    enableCompileCache(join(directory, 'compile-cache'))
  } catch {
    // Without a usable cache directory the CLI compiles its modules on every run, as it did before.
  }
}

enableCliCompileCache()
await import('./cli-main')
