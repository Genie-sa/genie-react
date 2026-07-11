#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PACKAGES_DIR = join(ROOT, 'packages')
const DEPENDENCY_FIELDS = [
  'dependencies',
  'optionalDependencies',
  'peerDependencies',
  'devDependencies',
]

function parseArguments(argv) {
  if (argv.length === 0) return { outputDirectory: mkdtempSync(join(tmpdir(), 'genie-release-')) }
  if (argv.length === 2 && argv[0] === '--output') {
    return { outputDirectory: resolve(argv[1]), preserveOutput: true }
  }
  throw new Error('Usage: node scripts/prepare-release.mjs [--output <directory>]')
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function publicPackages() {
  return readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const directory = join(PACKAGES_DIR, entry.name)
      const manifest = readJson(join(directory, 'package.json'))
      return { directory, manifest }
    })
    .filter(({ manifest }) => manifest.name && manifest.version && manifest.private !== true)
}

function dependencyFirst(packages) {
  const byName = new Map(packages.map((entry) => [entry.manifest.name, entry]))
  const visiting = new Set()
  const visited = new Set()
  const ordered = []

  function visit(entry) {
    const name = entry.manifest.name
    if (visited.has(name)) return
    if (visiting.has(name)) throw new Error(`Workspace dependency cycle includes ${name}`)
    visiting.add(name)
    for (const field of ['dependencies', 'optionalDependencies']) {
      for (const dependency of Object.keys(entry.manifest[field] ?? {})) {
        const internalDependency = byName.get(dependency)
        if (internalDependency) visit(internalDependency)
      }
    }
    visiting.delete(name)
    visited.add(name)
    ordered.push(entry)
  }

  for (const entry of packages) visit(entry)
  return ordered
}

function pack(entry, outputDirectory) {
  const output = execFileSync('pnpm', ['pack', '--json', '--pack-destination', outputDirectory], {
    cwd: entry.directory,
    encoding: 'utf8',
  })
  const result = JSON.parse(output)
  if (result.name !== entry.manifest.name || result.version !== entry.manifest.version) {
    throw new Error(
      `Packed identity mismatch for ${entry.manifest.name}: ${result.name}@${result.version}`,
    )
  }
  return resolve(result.filename)
}

function packedManifest(tarball, extractionRoot) {
  const extractionDirectory = mkdtempSync(join(extractionRoot, 'inspect-'))
  execFileSync('tar', ['-xzf', tarball, '-C', extractionDirectory])
  return readJson(join(extractionDirectory, 'package', 'package.json'))
}

function assertPublishable(manifest) {
  for (const field of DEPENDENCY_FIELDS) {
    for (const [name, range] of Object.entries(manifest[field] ?? {})) {
      if (typeof range === 'string' && range.startsWith('workspace:')) {
        throw new Error(`${manifest.name} has unresolved ${field}.${name}: ${range}`)
      }
    }
  }
}

function smokeInstall(tarballs, temporaryRoot) {
  const projectDirectory = mkdtempSync(join(temporaryRoot, 'install-'))
  writeFileSync(
    join(projectDirectory, 'package.json'),
    JSON.stringify({ name: 'release-smoke-test', private: true }),
  )
  execFileSync(
    'npm',
    ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false', ...tarballs],
    { cwd: projectDirectory, stdio: 'inherit' },
  )
}

const { outputDirectory, preserveOutput = false } = parseArguments(process.argv.slice(2))
const temporaryRoot = mkdtempSync(join(tmpdir(), 'genie-release-check-'))

try {
  mkdirSync(outputDirectory, { recursive: true })
  const plan = dependencyFirst(publicPackages()).map((entry) => {
    const tarball = pack(entry, outputDirectory)
    const manifest = packedManifest(tarball, temporaryRoot)
    assertPublishable(manifest)
    return {
      name: manifest.name,
      version: manifest.version,
      directory: relative(ROOT, entry.directory),
      tarball,
    }
  })
  smokeInstall(
    plan.map(({ tarball }) => tarball),
    temporaryRoot,
  )
  const planPath = join(outputDirectory, 'release-plan.tsv')
  writeFileSync(
    planPath,
    `${plan
      .map(({ name, version, directory, tarball }) =>
        [name, version, directory, tarball].join('\t'),
      )
      .join('\n')}\n`,
  )
  process.stdout.write(`Verified ${plan.length} release tarballs with a clean npm install\n`)
  if (preserveOutput) process.stdout.write(`Release plan: ${planPath}\n`)
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true })
  if (!preserveOutput) rmSync(outputDirectory, { recursive: true, force: true })
}
