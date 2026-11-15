import { api } from '../api/endpoints'
import type { ActivityEvent } from '../api/types'

export type LiveUpdateListener = (event: ActivityEvent) => void

const POLL_INTERVAL_MS = 3_000
const ALL_TOPICS = '*'

class LiveUpdates {
  private readonly listeners = new Map<string, Set<LiveUpdateListener>>()
  private cursor: number | null = null
  private timer: number | null = null
  private polling = false

  subscribe(topic: string, listener: LiveUpdateListener): () => void {
    const topicListeners = this.listeners.get(topic) ?? new Set()
    topicListeners.add(listener)
    this.listeners.set(topic, topicListeners)
    this.ensurePolling()
    return () => {
      topicListeners.delete(listener)
      if (topicListeners.size === 0) this.listeners.delete(topic)
      if (this.listenerCount() === 0) this.stopPolling()
    }
  }

  listenerCount(): number {
    let count = 0
    for (const topicListeners of this.listeners.values()) count += topicListeners.size
    return count
  }

  topics(): Record<string, number> {
    return Object.fromEntries(
      [...this.listeners].map(([topic, topicListeners]) => [topic, topicListeners.size]),
    )
  }

  private ensurePolling() {
    if (this.timer !== null) return
    this.timer = window.setInterval(() => void this.poll(), POLL_INTERVAL_MS)
  }

  private stopPolling() {
    if (this.timer === null) return
    window.clearInterval(this.timer)
    this.timer = null
  }

  private async poll() {
    if (this.polling) return
    this.polling = true
    try {
      const primed = this.cursor !== null
      const events = await api.activity(this.cursor ?? 0)
      this.cursor = events.reduce((latest, event) => Math.max(latest, event.id), this.cursor ?? 0)
      if (!primed) return
      for (const event of events) {
        for (const listener of this.listeners.get(event.topic) ?? []) listener(event)
        for (const listener of this.listeners.get(ALL_TOPICS) ?? []) listener(event)
      }
    } catch {
      return
    } finally {
      this.polling = false
    }
  }
}

export const liveUpdates = new LiveUpdates()
export const LIVE_UPDATES_ALL_TOPICS = ALL_TOPICS
