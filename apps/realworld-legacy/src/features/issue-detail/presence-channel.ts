type Listener = (viewerIds: string[]) => void

const VIEWER_POOL = ['u-4', 'u-9', 'u-17']
const rooms = new Map<string, Set<Listener>>()

function viewersFor(issueKey: string, ownId: string): string[] {
  const seed = [...issueKey].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return [ownId, ...VIEWER_POOL.slice(0, seed % (VIEWER_POOL.length + 1))]
}

export function joinPresence(issueKey: string, userId: string, listener: Listener): () => void {
  const room = rooms.get(issueKey) ?? new Set<Listener>()
  rooms.set(issueKey, room)
  room.add(listener)
  const timer = setTimeout(() => listener(viewersFor(issueKey, userId)), 50)
  return () => {
    clearTimeout(timer)
    room.delete(listener)
    if (room.size === 0) rooms.delete(issueKey)
  }
}
