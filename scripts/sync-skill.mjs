#!/usr/bin/env node
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// `npx skills add Genie-sa/genie-react` reads skills/genie from git; packages/cli/skill is the only source,
// and its metadata version follows @genie-react/cli so doctor's bundledSkill matches the installed CLI.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = join(ROOT, 'packages/cli/skill')
const MIRROR = join(ROOT, 'skills/genie')
const check = process.argv.includes('--check')
const VERSION_LINE = /^(\s*version:\s*)["']?[^\s"']+["']?$/m
const { version } = JSON.parse(readFileSync(join(ROOT, 'packages/cli/package.json'), 'utf8'))

const markdownIn = (directory) => {
  try {
    return readdirSync(directory).filter((name) => name.endsWith('.md'))
  } catch {
    return []
  }
}
const read = (directory, name) => readFileSync(join(directory, name), 'utf8')

const sourceFiles = markdownIn(SOURCE)
if (sourceFiles.length === 0) {
  console.error(`No skill files found in ${SOURCE}`)
  process.exit(1)
}

const skill = read(SOURCE, 'SKILL.md')
if (!VERSION_LINE.test(skill)) {
  console.error('packages/cli/skill/SKILL.md has no metadata version line to stamp')
  process.exit(1)
}
const stamped = skill.replace(VERSION_LINE, `$1"${version}"`)
if (stamped !== skill) {
  if (check) {
    console.error(`packages/cli/skill/SKILL.md says another version than @genie-react/cli ${version}`)
    console.error('Run: node scripts/sync-skill.mjs')
    process.exit(1)
  }
  writeFileSync(join(SOURCE, 'SKILL.md'), stamped)
}
const mirrorFiles = markdownIn(MIRROR)
const drift = [
  ...sourceFiles.filter(
    (name) => !mirrorFiles.includes(name) || read(SOURCE, name) !== read(MIRROR, name),
  ),
  ...mirrorFiles.filter((name) => !sourceFiles.includes(name)),
]

if (check) {
  if (drift.length > 0) {
    console.error(`skills/genie differs from packages/cli/skill: ${drift.join(', ')}`)
    console.error('Run: node scripts/sync-skill.mjs')
    process.exit(1)
  }
  process.exit(0)
}

rmSync(MIRROR, { recursive: true, force: true })
mkdirSync(MIRROR, { recursive: true })
for (const name of sourceFiles) writeFileSync(join(MIRROR, name), read(SOURCE, name))
console.log(`synced ${sourceFiles.length} files to skills/genie`)
