export type CoordinatorEvent = {
  paneKey: string
  repoId: string
  state: string
  stateStartedAt: number
  title: string
  agentType: string
  workspace: string
  path: string
  message: string
  sessionBoundary?: boolean
  hidden?: boolean
  restored?: boolean
}

export class CoordinatorEvents {
  private previous = new Map<string, string>()
  private seen = new Set<string>()
  private batches = new Map<string, { due: number; events: CoordinatorEvent[] }>()
  observe(events: CoordinatorEvent[], coordinators: Record<string, string>, now: number): void {
    const next = new Map<string, string>()
    for (const event of events) {
      const key = JSON.stringify([event.paneKey, event.state, event.stateStartedAt])
      next.set(event.paneKey, key)
      const previous = this.previous.get(event.paneKey)
      if (
        !previous ||
        previous === key ||
        this.seen.has(key) ||
        event.hidden ||
        event.restored ||
        event.sessionBoundary ||
        !coordinators[event.repoId] ||
        coordinators[event.repoId] === event.paneKey ||
        !['done', 'waiting', 'blocked', 'error', 'failed'].includes(event.state)
      ) {
        continue
      }
      this.seen.add(key)
      const batch = this.batches.get(event.repoId) ?? { due: now + 5000, events: [] }
      batch.events.push(event)
      this.batches.set(event.repoId, batch)
    }
    this.previous = next
    for (const repoId of this.batches.keys()) {
      if (!coordinators[repoId]) {
        this.batches.delete(repoId)
      }
    }
  }
  ready(now: number): string[] {
    return [...this.batches].filter(([, batch]) => batch.due <= now).map(([id]) => id)
  }
  take(repoId: string): CoordinatorEvent[] {
    const events = this.batches.get(repoId)?.events ?? []
    this.batches.delete(repoId)
    return events
  }
  retry(repoId: string, events: CoordinatorEvent[]): void {
    const existing = this.batches.get(repoId)
    this.batches.set(repoId, { due: Infinity, events: [...events, ...(existing?.events ?? [])] })
  }
  coordinatorDone(repoId: string, now: number): void {
    const batch = this.batches.get(repoId)
    if (batch?.due === Infinity) {
      batch.due = now
    }
  }
}

export function formatCoordinatorEvents(events: CoordinatorEvent[]): string {
  const clean = (text: string): string => text.replace(/\s+/g, ' ').trim()
  const lines = events.map((event) => {
    const waiting = event.state === 'blocked' || event.state === 'waiting'
    const status = waiting ? 'waiting for user input' : event.state
    const detail = `${waiting ? 'Question' : 'Last message'}: ${clean(event.message).slice(0, 200)}`
    return `- "${clean(event.title)}" (${event.agentType}, workspace ${clean(event.workspace)}, path ${clean(event.path)}): ${status}. ${detail}`
  })
  return `[Orca event] ${events.length} agent update(s):\n${lines.join('\n')}`
}
