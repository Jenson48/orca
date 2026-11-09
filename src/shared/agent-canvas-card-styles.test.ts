import { describe, expect, it } from 'vitest'
import { normalizeCardStyles } from './agent-canvas-card-styles'
import {
  type AgentCanvasProjectLayout,
  emptyAgentCanvasProject,
  omitAgentCanvasPaneKeys,
  placeAgentCanvasRow
} from './agent-canvas-layout'

describe('canvas card styles', () => {
  it('trims and limits text and rejects unknown choices and empty entries', () => {
    expect(
      normalizeCardStyles({
        a: { name: '  Review  ', note: '  todo  ', color: 'sky', icon: 'code' },
        b: { color: 'invalid', icon: 'invalid', name: ' ' },
        c: { name: 'x'.repeat(81), note: 'y'.repeat(501) }
      })
    ).toEqual({
      a: { name: 'Review', note: 'todo', color: 'sky', icon: 'code' },
      c: { name: 'x'.repeat(80), note: 'y'.repeat(500) }
    })
  })
  it('prunes styles with panes and preserves unchanged identity', () => {
    const project: AgentCanvasProjectLayout = {
      ...emptyAgentCanvasProject(),
      cardStyles: { a: { name: 'Review' }, b: { note: 'Keep' } }
    }
    const layout = { projects: { repo: project } }
    expect(omitAgentCanvasPaneKeys(layout, new Set(['unknown']))).toBe(layout)
    expect(omitAgentCanvasPaneKeys(layout, new Set(['a'])).projects.repo.cardStyles).toEqual({
      b: { note: 'Keep' }
    })
  })
})
describe('canvas row placement', () => {
  it('places a deduplicated row beside existing cards and moves previously placed agents', () => {
    const project: AgentCanvasProjectLayout = {
      ...emptyAgentCanvasProject(),
      tabs: [
        { id: 'main', name: 'Main', cards: { old: { x: 40, y: 30 } } },
        { id: 'other', name: 'Other', cards: { a: { x: 0, y: 0 } } }
      ]
    }
    const next = placeAgentCanvasRow(project, 'main', ['a', 'b', 'a'])
    expect(next.tabs[0].cards).toEqual({
      old: { x: 40, y: 30 },
      a: { x: 320, y: 30 },
      b: { x: 600, y: 30 }
    })
    expect(next.tabs[1].cards).toEqual({})
    expect(project.tabs[1].cards).toEqual({ a: { x: 0, y: 0 } })
    expect(placeAgentCanvasRow(project, 'missing', ['a'])).toBe(project)
  })
})
