import { describe, expect, it } from 'vitest'
import {
  causePattern,
  componentNames,
  extractAnswer,
  gradeAnswer,
  normalizeFile,
  passAtK,
  passHatK,
} from './grade.mjs'

const truth = {
  components: ['StatusBadge', 'SearchScreen'],
  files: ['src/screens/search/SearchScreen.tsx'],
  causePatterns: ['appearance|object|prop', 'new|inline|recreat|every render'],
  summary: 'inline object prop',
}

describe('extractAnswer', () => {
  it('returns the last fenced JSON answer', () => {
    const text = [
      'First guess:',
      '```json',
      '{"component":"ResultCount","cause":"a","file":"b"}',
      '```',
      'Final:',
      '```json',
      '{"component":"StatusBadge","cause":"c","file":"d"}',
      '```',
    ].join('\n')
    expect(extractAnswer(text)).toEqual({ component: 'StatusBadge', cause: 'c', file: 'd' })
  })

  it('accepts an unfenced trailing object and ignores unrelated JSON', () => {
    const text = '```json\n{"ok":true}\n```\nAnswer: {"component":"A","cause":"b","file":"c"}'
    expect(extractAnswer(text)).toEqual({ component: 'A', cause: 'b', file: 'c' })
  })

  it('pairs fences correctly after a code block and allows braces inside strings', () => {
    const text = [
      'The badge gets a new object:',
      '```tsx',
      "<StatusBadge appearance={{ tone: 'success' }} />",
      '```',
      'Hoist it.',
      '',
      '```json',
      `{"component": "StatusBadge", "cause": "passes \`appearance={{ tone: 'success' }}\` inline", "file": "src/a.tsx"}`,
      '```',
    ].join('\n')
    expect(extractAnswer(text)).toEqual({
      component: 'StatusBadge',
      cause: "passes `appearance={{ tone: 'success' }}` inline",
      file: 'src/a.tsx',
    })
  })

  it('returns null without an answer', () => {
    expect(extractAnswer('I could not find it. ```json\n{not json}\n```')).toBeNull()
  })
})

describe('componentNames', () => {
  it('keeps multi-word PascalCase and hook names once, in order', () => {
    expect(componentNames('React.memo(StatusBadge) via useAddTask and StatusBadge in App')).toEqual(
      ['StatusBadge', 'useAddTask'],
    )
  })

  it('skips React and TanStack Query hooks named as context', () => {
    expect(componentNames('ReportTable (useEffect + useState)')).toEqual(['ReportTable'])
    expect(componentNames('useQueryClient in AddTaskForm via useMutation')).toEqual(['AddTaskForm'])
    expect(componentNames('CartSummary (useCartStore selector)')).toEqual([
      'CartSummary',
      'useCartStore',
    ])
  })
})

describe('causePattern', () => {
  it('expands the shared identity alternation and matches case-insensitively', () => {
    const pattern = causePattern('@identity|shallow')
    expect(pattern.test('fails the object.is check')).toBe(true)
    expect(pattern.test('recreated each render')).toBe(true)
    expect(pattern.test('shallow compare')).toBe(true)
    expect(pattern.test('the label prop changes')).toBe(false)
  })
})

describe('normalizeFile', () => {
  it('strips project roots, ./ prefixes and line suffixes', () => {
    expect(normalizeFile('/tmp/genie-eval-x/src/a.tsx:12:4', '/tmp/genie-eval-x')).toBe('src/a.tsx')
    expect(normalizeFile('/private/tmp/w/src/a.tsx', '/private/tmp/w')).toBe('src/a.tsx')
    expect(normalizeFile('/tmp/w/src/a.tsx', '/private/tmp/w')).toBe('src/a.tsx')
    expect(normalizeFile('./src/a.tsx#L4-L9')).toBe('src/a.tsx')
    expect(normalizeFile('`src\\a.tsx`')).toBe('src/a.tsx')
  })
})

describe('gradeAnswer', () => {
  it('passes a correct answer, including a basename-only file', () => {
    const grade = gradeAnswer(
      {
        component: '<StatusBadge> (memo)',
        cause: 'SearchScreen passes a new inline appearance object every render.',
        file: 'SearchScreen.tsx:26',
      },
      truth,
    )
    expect(grade.pass).toBe(true)
    expect(grade.checks.every((check) => check.pass)).toBe(true)
  })

  it('fails each wrong field independently', () => {
    const grade = gradeAnswer(
      {
        component: 'ResultCount',
        cause: 'count changes',
        file: 'src/screens/search/StatusBadge.tsx',
      },
      truth,
    )
    expect(grade.pass).toBe(false)
    expect(Object.fromEntries(grade.checks.map((check) => [check.name, check.pass]))).toEqual({
      component: false,
      file: false,
      cause: false,
    })
  })

  it('does not accept a component name that only contains an accepted name', () => {
    const grade = gradeAnswer(
      { component: 'StatusBadgeList', cause: 'new appearance object', file: 'SearchScreen.tsx' },
      truth,
    )
    expect(grade.checks.find((check) => check.name === 'component')?.pass).toBe(false)
  })

  it('rejects shotgun component lists and names outside the accepted set', () => {
    const component = (name: string) =>
      gradeAnswer(
        { component: name, cause: 'new inline appearance object', file: 'SearchScreen.tsx' },
        truth,
      ).checks.find((check) => check.name === 'component')?.pass
    expect(component('StatusBadge (rendered by SearchScreen)')).toBe(true)
    expect(component('Memoized StatusBadge')).toBe(true)
    expect(component('StatusBadge, ResultCount')).toBe(false)
    expect(component('ResultCount, StatusBadge')).toBe(false)
    expect(component('StatusBadge, SearchScreen, StatusBadgeRow')).toBe(false)
    expect(component('the badge')).toBe(false)
  })

  it('fails a missing answer', () => {
    expect(gradeAnswer(null, truth)).toMatchObject({ pass: false, answer: null })
  })
})

describe('pass@k and pass^k', () => {
  it('matches closed forms', () => {
    expect(passAtK(5, 0, 1)).toBe(0)
    expect(passAtK(5, 5, 1)).toBe(1)
    expect(passAtK(4, 2, 1)).toBeCloseTo(0.5)
    expect(passAtK(4, 2, 2)).toBeCloseTo(1 - 1 / 6)
    expect(passHatK(4, 2, 2)).toBeCloseTo(1 / 6)
    expect(passHatK(3, 3, 3)).toBe(1)
    expect(passHatK(3, 2, 3)).toBe(0)
  })

  it('is undefined when k exceeds the trial count', () => {
    expect(passAtK(2, 1, 3)).toBeNull()
    expect(passHatK(0, 0, 1)).toBeNull()
  })
})
