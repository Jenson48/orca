import { describe, expect, it } from 'vitest'
import {
  CoordinatorEvents,
  formatCoordinatorEvents,
  type CoordinatorEvent
} from './coordinator-events'
const event: CoordinatorEvent = {
  paneKey: 'a',
  repoId: 'r',
  state: 'working',
  stateStartedAt: 1,
  title: 'Agent',
  agentType: 'codex',
  workspace: 'main',
  path: '/repo',
  message: 'Finished'
}
describe('coordinator events', () => {
  it('ignores hydration, self and boundaries and deduplicates transitions', () => {
    const feed = new CoordinatorEvents()
    feed.observe([{ ...event, state: 'done' }], { r: 'coordinator' }, 0)
    expect(feed.ready(10000)).toEqual([])
    feed.observe(
      [{ ...event, state: 'done', stateStartedAt: 2, sessionBoundary: true }],
      { r: 'coordinator' },
      1
    )
    expect(feed.ready(10000)).toEqual([])
    feed.observe([{ ...event, state: 'waiting', stateStartedAt: 3 }], { r: 'coordinator' }, 10)
    feed.observe([{ ...event, state: 'waiting', stateStartedAt: 3 }], { r: 'coordinator' }, 20)
    expect(feed.ready(5009)).toEqual([])
    expect(feed.ready(5010)).toEqual(['r'])
    expect(feed.take('r')).toHaveLength(1)
    feed.observe([{ ...event, state: 'done', stateStartedAt: 4 }], { r: 'a' }, 30)
    expect(feed.ready(10000)).toEqual([])
  })
  it('retains refused batches until coordinator completion', () => {
    const feed = new CoordinatorEvents()
    feed.retry('r', [event])
    expect(feed.ready(10000)).toEqual([])
    feed.coordinatorDone('r', 10001)
    expect(feed.ready(10001)).toEqual(['r'])
    expect(feed.take('r')).toEqual([event])
  })
  it('formats discoverable workspace and concise output', () => {
    expect(formatCoordinatorEvents([{ ...event, state: 'done' }])).toBe(
      '[Orca event] 1 agent update(s):\n- "Agent" (codex, workspace main, path /repo): done. Last message: Finished'
    )
  })
})
