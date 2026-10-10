export interface Task {
  id: number
  title: string
}

export interface Profile {
  name: string
  email: string
  address?: { city: string; country: string }
}

const LATENCY_MS = 120

const tasks: Task[] = [
  { id: 1, title: 'Renew TLS certificate' },
  { id: 2, title: 'Rotate API keys' },
]

const bootedAt = Date.now()

function respond<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), LATENCY_MS))
}

export const api = {
  listTasks: () => respond(tasks),
  addTask(title: string) {
    const task = { id: tasks.length + 1, title }
    tasks.push(task)
    return respond(task)
  },
  openOrderCount: () => respond(12 + Math.floor((Date.now() - bootedAt) / 3000)),
  profile: () => respond<Profile>({ name: 'Dana Whitfield', email: 'dana@example.com' }),
}
