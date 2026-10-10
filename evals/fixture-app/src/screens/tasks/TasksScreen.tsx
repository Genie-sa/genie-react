import { type FormEvent, useState } from 'react'
import { useAddTask, useTasks } from './taskQueries'

function TaskList() {
  const { data: tasks, isPending } = useTasks()
  if (isPending) return <p>Loading tasks…</p>
  return (
    <ul aria-label="Tasks">
      {tasks?.map((task) => (
        <li key={task.id}>{task.title}</li>
      ))}
    </ul>
  )
}

function AddTaskForm() {
  const [title, setTitle] = useState('')
  const addTask = useAddTask()

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) return
    addTask.mutate(title.trim(), { onSuccess: () => setTitle('') })
  }

  return (
    <form onSubmit={submit} className="row">
      <input
        aria-label="New task title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <button type="submit" disabled={addTask.isPending}>
        Add task
      </button>
      {addTask.isSuccess && <span>Saved</span>}
    </form>
  )
}

export function TasksScreen() {
  return (
    <section className="card">
      <h1>Tasks</h1>
      <AddTaskForm />
      <TaskList />
    </section>
  )
}
