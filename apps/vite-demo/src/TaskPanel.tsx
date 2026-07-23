import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { GenieToolError, useGenieTool } from 'genie-react'
import { z } from 'zod'

type Role = 'guest' | 'member' | 'admin'

interface Task {
  id: number
  title: string
  done: boolean
}

const CAN_ADD: Record<Role, boolean> = { guest: false, member: true, admin: true }
const CAN_DELETE: Record<Role, boolean> = { guest: false, member: false, admin: true }

// In-memory "backend" with injectable faults, so agents can exercise loading and error states on demand.
let tasks: Task[] = [
  { id: 1, title: 'water the plants', done: false },
  { id: 2, title: 'ship the release', done: true },
]
let nextId = 3
const chaos = { failNextRequests: 0, latencyMs: 150 }

async function fakeApi<T>(run: () => T): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, chaos.latencyMs))
  if (chaos.failNextRequests > 0) {
    chaos.failNextRequests -= 1
    throw new Error('injected API failure (armed via app_chaos)')
  }
  return run()
}

const taskApi = {
  list: () => fakeApi(() => tasks.map((task) => ({ ...task }))),
  add: (title: string) =>
    fakeApi(() => {
      const task: Task = { id: nextId++, title, done: false }
      tasks.push(task)
      return task
    }),
  toggle: (id: number) =>
    fakeApi(() => {
      const task = tasks.find((candidate) => candidate.id === id)
      if (task) task.done = !task.done
      return task
    }),
  remove: (id: number) =>
    fakeApi(() => {
      tasks = tasks.filter((candidate) => candidate.id !== id)
      return { removed: id }
    }),
}

export function TaskPanel(): ReactNode {
  const [role, setRole] = useState<Role>('guest')
  const [title, setTitle] = useState('')
  const queryClient = useQueryClient()
  const invalidateTasks = () => queryClient.invalidateQueries({ queryKey: ['tasks'] })

  const tasksQuery = useQuery({ queryKey: ['tasks'], queryFn: taskApi.list, retry: false })
  const addTask = useMutation({ mutationFn: taskApi.add, onSuccess: invalidateTasks })
  const toggleTask = useMutation({ mutationFn: taskApi.toggle, onSuccess: invalidateTasks })
  const removeTask = useMutation({ mutationFn: taskApi.remove, onSuccess: invalidateTasks })

  useGenieTool({
    name: 'session',
    kind: 'query',
    description:
      'Current demo session: the active role and what the task UI permits (guest reads, member adds, admin also deletes).',
    handler: () => ({ role, canAdd: CAN_ADD[role], canDelete: CAN_DELETE[role] }),
  })

  useGenieTool({
    name: 'login_as',
    kind: 'action',
    idempotent: true,
    description:
      'Switches the demo session role and re-gates the task UI instantly — no login form to drive. Use before testing role-restricted interactions.',
    input: z.object({ role: z.enum(['guest', 'member', 'admin']) }),
    handler: ({ role: next }) => {
      setRole(next)
      return { role: next, canAdd: CAN_ADD[next], canDelete: CAN_DELETE[next] }
    },
  })

  useGenieTool({
    name: 'seed_tasks',
    kind: 'action',
    description:
      'Seeds N fixture tasks through the same fake API the UI uses, then refetches the ["tasks"] query. Use to set up list state before testing interactions.',
    input: z.object({
      count: z.number().int().min(1).max(25).default(3),
      done: z.boolean().default(false),
    }),
    handler: async ({ count, done }) => {
      for (let i = 0; i < count; i++) {
        tasks.push({ id: nextId++, title: `seeded task #${nextId - 1}`, done })
      }
      await invalidateTasks()
      return { created: count, total: tasks.length }
    },
  })

  useGenieTool({
    name: 'reset_tasks',
    kind: 'action',
    destructive: true,
    description:
      'Deletes every task and refetches — a clean slate before the next test run. Destructive: there is no undo.',
    handler: async () => {
      if (tasks.length === 0) {
        throw new GenieToolError('task list is already empty', {
          code: 'NO_OP',
          hint: 'seed fixtures with app_seed_tasks',
        })
      }
      const removed = tasks.length
      tasks = []
      await invalidateTasks()
      return { removed }
    },
  })

  useGenieTool({
    name: 'chaos',
    kind: 'action',
    description:
      'Injects faults into the fake task API: fail the next N requests and/or set request latency in ms. Use to reproduce loading and error states, then inspect them with query_list or react_error_state.',
    input: z.object({
      failNextRequests: z.number().int().min(0).max(10).optional(),
      latencyMs: z.number().int().min(0).max(5000).optional(),
    }),
    handler: ({ failNextRequests, latencyMs }) => {
      if (failNextRequests !== undefined) chaos.failNextRequests = failNextRequests
      if (latencyMs !== undefined) chaos.latencyMs = latencyMs
      return { ...chaos }
    },
  })

  const submitTask = (): void => {
    const trimmed = title.trim()
    if (!trimmed) return
    addTask.mutate(trimmed)
    setTitle('')
  }

  return (
    <section id="tasks">
      <h2>Task manager</h2>
      <p className="lab-line">
        role: <strong data-testid="role">{role}</strong>
        {!CAN_ADD[role] && ' · read-only'}
      </p>

      {tasksQuery.isError && (
        <p className="lab-line" role="alert">
          tasks failed to load: {tasksQuery.error.message}{' '}
          <button type="button" onClick={() => void tasksQuery.refetch()}>
            retry
          </button>
        </p>
      )}
      {tasksQuery.isPending && <p className="lab-line">loading tasks…</p>}

      <ul data-testid="task-list">
        {(tasksQuery.data ?? []).map((task) => (
          <li key={task.id} className="lab-line">
            <label>
              <input
                type="checkbox"
                checked={task.done}
                onChange={() => toggleTask.mutate(task.id)}
              />
              {task.title}
            </label>
            {CAN_DELETE[role] && (
              <button type="button" onClick={() => removeTask.mutate(task.id)}>
                delete
              </button>
            )}
          </li>
        ))}
      </ul>

      <input
        placeholder={CAN_ADD[role] ? 'new task title' : 'log in to add tasks'}
        value={title}
        disabled={!CAN_ADD[role]}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && submitTask()}
      />
      <button type="button" disabled={!CAN_ADD[role] || !title.trim()} onClick={submitTask}>
        add task
      </button>
    </section>
  )
}
