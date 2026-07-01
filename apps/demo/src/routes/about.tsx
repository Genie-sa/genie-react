import { Link, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/about")({ component: About })

function About() {
  return (
    <div className="flex min-h-svh p-6">
      <div className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose">
        <h1 className="font-medium">About</h1>
        <p>A second route, used to exercise router_navigate from the agent.</p>
        <Link to="/" className="underline">
          ← Home
        </Link>
      </div>
    </div>
  )
}
