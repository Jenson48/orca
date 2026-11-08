import { describe, expect, it } from 'vitest'
import {
  type AgentCanvasProjectLayout,
  emptyAgentCanvasProject,
  normalizeAgentCanvasLayouts,
  omitAgentCanvasTabPanes,
  placeNewAgentCanvasCards,
  removeAgentCanvasTab
} from './agent-canvas-layout'

describe('agent canvas layout', () => {
  it('places only agents that are on no tab, a fork beside its parent', () => {
    const project: AgentCanvasProjectLayout = {
      tabs: [
        { id: 'main', name: 'Main', cards: { parent: { x: 0, y: 0 } } },
        { id: 'exp', name: 'Exp', cards: { elsewhere: { x: 0, y: 0 } } }
      ],
      activeTabId: 'main'
    }
    const next = placeNewAgentCanvasCards(project, 'main', [
      { paneKey: 'parent', nearPaneKeys: [] },
      { paneKey: 'elsewhere', nearPaneKeys: [] },
      { paneKey: 'fork', nearPaneKeys: ['parent'] },
      { paneKey: 'fresh', nearPaneKeys: [] }
    ])
    expect(next?.tabs[0].cards).toEqual({
      parent: { x: 0, y: 0 },
      fork: { x: 280, y: 0 },
      fresh: { x: 560, y: 0 }
    })
    expect(next?.tabs[1].cards).toEqual({ elsewhere: { x: 0, y: 0 } })
    expect(placeNewAgentCanvasCards(next!, 'main', [{ paneKey: 'fork', nearPaneKeys: [] }])).toBe(
      null
    )
  })

  it('closing a tab moves its cards to Main instead of dropping them', () => {
    const project: AgentCanvasProjectLayout = {
      tabs: [
        { id: 'main', name: 'Main', cards: { a: { x: 0, y: 0 } } },
        { id: 'exp', name: 'Exp', cards: { b: { x: 0, y: 0 } } }
      ],
      activeTabId: 'exp'
    }
    expect(removeAgentCanvasTab(project, 'exp')).toEqual({
      tabs: [{ id: 'main', name: 'Main', cards: { a: { x: 0, y: 0 }, b: { x: 280, y: 0 } } }],
      activeTabId: 'main'
    })
  })

  it('repairs persisted layouts: keeps Main, drops duplicate panes and bad points', () => {
    const layouts = normalizeAgentCanvasLayouts({
      repoId: 'r',
      width: 99999,
      projects: {
        r: {
          activeTabId: 'gone',
          tabs: [
            { id: 'exp', name: 'Exp', cards: { a: { x: 1, y: 2 }, bad: { x: 'no' } } },
            { id: 'exp2', name: '', cards: { a: { x: 5, y: 5 } } }
          ]
        }
      }
    })
    expect(layouts.width).toBe(2400)
    expect(layouts.projects.r).toEqual({
      tabs: [
        emptyAgentCanvasProject().tabs[0],
        { id: 'exp', name: 'Exp', cards: { a: { x: 1, y: 2 } } },
        { id: 'exp2', name: 'Untitled', cards: {} }
      ],
      activeTabId: 'main'
    })
  })
})

describe('omitAgentCanvasTabPanes', () => {
  it('drops cards of closed tabs and keeps identity otherwise', () => {
    const layouts = {
      repoId: null,
      projects: {
        r: {
          tabs: [
            { id: 'main', name: 'Main', cards: { 't1:a': { x: 0, y: 0 }, 't2:b': { x: 1, y: 1 } } }
          ],
          activeTabId: 'main'
        }
      }
    }
    expect(omitAgentCanvasTabPanes(layouts, new Set(['t9']))).toBe(layouts)
    const next = omitAgentCanvasTabPanes(layouts, new Set(['t1']))
    expect(Object.keys(next.projects.r.tabs[0].cards)).toEqual(['t2:b'])
  })
})

it.each(['parent', 'sibling'])('places beside a %s on another tab', (relative) => {
  const project: AgentCanvasProjectLayout = {
    activeTabId: 'main',
    tabs: [
      { id: 'main', name: 'Main', cards: {} },
      { id: 'other', name: 'Other', cards: { [relative]: { x: 40, y: 60 } } }
    ]
  }
  const next = placeNewAgentCanvasCards(project, 'main', [
    { paneKey: 'new', nearPaneKeys: [relative] },
    { paneKey: 'unrelated', nearPaneKeys: [] }
  ])
  expect(next?.tabs[1].cards.new).toEqual({ x: 320, y: 60 })
  expect(next?.tabs[0].cards).toEqual({ unrelated: { x: 0, y: 0 } })
  expect(project.tabs[1].cards.new).toBeUndefined()
})
