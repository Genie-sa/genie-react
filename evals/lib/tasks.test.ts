import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkTaskAgainstFixture, loadTasks, selectTasks, validateTask } from './tasks.mjs'

const TASKS_DIR = join(import.meta.dirname, '../tasks')
const FIXTURE_DIR = join(import.meta.dirname, '../fixture-app')

const validTask = {
  id: 'example-task',
  split: 'dev',
  mode: 'diagnose',
  screen: 'search',
  prompt: 'Something re-renders too much, find out why.',
  truth: { components: ['AlphaCard'], files: ['src/a.tsx'], causePatterns: ['x'], summary: 's' },
  referenceAnswer: { component: 'AlphaCard', cause: 'x', file: 'src/a.tsx' },
  decoyAnswers: [{ component: 'BetaCard', cause: 'y', file: 'src/b.tsx' }],
  referenceFix: [{ file: 'src/a.tsx', find: 'a', replace: 'b' }],
}

describe('validateTask', () => {
  it('accepts a well-formed task', () => {
    expect(validateTask(validTask, 'tasks/example-task.json')).toEqual([])
  })

  it('reports schema problems', () => {
    const problems = validateTask(
      {
        ...validTask,
        split: 'train',
        mode: 'fix',
        truth: { ...validTask.truth, components: ['Alpha'], causePatterns: ['('] },
        acceptedAnswers: [{ component: 'AlphaCard' }],
        decoyAnswers: [{ component: 'BetaCard' }],
      },
      'tasks/other.json',
    )
    expect(problems).toEqual([
      'tasks/other.json: file name must match id',
      'tasks/other.json: split must be "dev" or "held-out"',
      'tasks/other.json: truth.components entry "Alpha" must be a multi-word PascalCase or useX name',
      'tasks/other.json: truth.causePatterns has an invalid regex: (',
      'tasks/other.json: acceptedAnswers must list answers with component, cause and file',
      'tasks/other.json: each decoyAnswers entry needs component, cause and file',
      'tasks/other.json: fix tasks need a runtime probe',
    ])
  })

  it('validates probe shape', () => {
    const problems = validateTask(
      { ...validTask, probe: { steps: [['type']], renders: { component: 'A' } } },
      'tasks/example-task.json',
    )
    expect(problems).toEqual([
      'tasks/example-task.json: probe.renders needs component and integer maxUpdates',
    ])
  })
})

describe('task suite', async () => {
  const { tasks, problems } = await loadTasks(TASKS_DIR)

  it('loads without schema problems and keeps a held-out split', () => {
    expect(problems).toEqual([])
    expect(tasks.length).toBeGreaterThan(0)
    expect(tasks.some((task) => task.split === 'held-out')).toBe(true)
    expect(
      selectTasks(tasks, { ids: [], split: 'dev' }).every((task) => task.split === 'dev'),
    ).toBe(true)
  })

  it.each(tasks.map((task) => [task.id, task] as const))(
    '%s matches the fixture and its graders',
    async (_id, task) => {
      expect(await checkTaskAgainstFixture(task, FIXTURE_DIR)).toEqual([])
    },
  )

  it('reports tasks that drift from the fixture', async () => {
    const task = { ...validTask, screen: 'missing', path: 'tasks/example-task.json' } as const
    const problems = await checkTaskAgainstFixture(
      {
        ...task,
        acceptedAnswers: [validTask.decoyAnswers[0]],
        decoyAnswers: [validTask.decoyAnswers[0], task.referenceAnswer],
      } as Parameters<typeof checkTaskAgainstFixture>[0],
      FIXTURE_DIR,
    )
    expect(problems).toEqual([
      'example-task: screen "missing" is not registered in App.tsx',
      'example-task: truth file src/a.tsx does not exist',
      'example-task: accepted answer fails: {"component":"BetaCard","cause":"y","file":"src/b.tsx"}',
      'example-task: decoy answer passes: {"component":"AlphaCard","cause":"x","file":"src/a.tsx"}',
      'example-task: reference edit in src/a.tsx matches 0 times, expected 1',
    ])
  })

  it('rejects unknown task ids', () => {
    expect(() => selectTasks(tasks, { ids: ['missing'], split: 'all' })).toThrow('missing')
  })
})
