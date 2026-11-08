import { describe, expect, it } from 'vitest'
import {
  type AgentCanvasProjectLayout,
  emptyAgentCanvasProject,
  moveAgentCanvasCards,
  omitAgentCanvasPaneKeys,
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

const editableProject: AgentCanvasProjectLayout = {
  activeTabId: 'exp',
  tabs: [
    { id: 'main', name: 'Main', cards: {} },
    {
      id: 'exp',
      name: 'Exp',
      cards: { 't:a': { x: 0, y: 0 }, 't:b': { x: 280, y: 0 } },
      items: {
        title: { type: 'text', x: 20, y: -40, text: 'Plan', style: 'heading' },
        area: { type: 'frame', x: -20, y: -60, text: 'Team', width: 600, height: 240, color: 'sky' }
      },
      edges: [{ id: 'e', source: 'agent:t:a', target: 'item:title', label: 'Next' }]
    }
  ]
}

it('round trips editable items and edges while old fields remain optional', () => {
  expect(normalizeAgentCanvasLayouts({ projects: { r: editableProject } }).projects.r).toEqual(
    editableProject
  )
  expect(
    normalizeAgentCanvasLayouts({ projects: { r: emptyAgentCanvasProject() } }).projects.r
  ).toEqual({
    activeTabId: 'main',
    tabs: [{ id: 'main', name: 'Main', cards: {} }]
  })
})

it('drops invalid items, dangling endpoints, duplicate edges and self loops', () => {
  const tab = editableProject.tabs[1]
  const project = {
    ...editableProject,
    tabs: [
      editableProject.tabs[0],
      {
        ...tab,
        items: {
          ...tab.items,
          bad: { type: 'text', x: Infinity, y: 0, text: '' },
          style: { type: 'text', x: 0, y: 0, text: '', style: 'unknown' },
          size: { type: 'frame', x: 0, y: 0, text: '', width: -1 }
        },
        edges: [
          ...tab.edges!,
          { id: 'dup', source: 'agent:t:a', target: 'item:title' },
          { id: 'self', source: 'agent:t:a', target: 'agent:t:a' },
          { id: 'missing', source: 'agent:missing', target: 'item:title' },
          { id: 'frame', source: 'agent:t:a', target: 'item:area' }
        ]
      }
    ]
  }
  expect(normalizeAgentCanvasLayouts({ projects: { r: project } }).projects.r).toEqual(
    editableProject
  )
})

it('moving a card drops its source user edges', () => {
  const moved = moveAgentCanvasCards(editableProject, ['t:a'], 'main')
  expect(moved.tabs[1].edges).toEqual([])
  expect(moved.tabs[0].cards).toEqual({ 't:a': { x: 0, y: 0 } })
  expect(moved.tabs[1].items).toBe(editableProject.tabs[1].items)
})

it('removing a canvas tab brings its items and edges to Main', () => {
  const moved = removeAgentCanvasTab(editableProject, 'exp')
  expect(moved.activeTabId).toBe('main')
  expect(moved.tabs).toHaveLength(1)
  expect(moved.tabs[0].items).toEqual({
    title: { type: 'text', x: 20, y: -40, text: 'Plan', style: 'heading' },
    area: { type: 'frame', x: -20, y: -60, text: 'Team', width: 600, height: 240, color: 'sky' }
  })
  expect(moved.tabs[0].edges).toEqual([
    { id: 'e', source: 'agent:t:a', target: 'item:title', label: 'Next' }
  ])
})

it('pane and terminal tab removal drop dangling edges and preserve unchanged identity', () => {
  const layouts = { projects: { r: editableProject } }
  expect(omitAgentCanvasPaneKeys(layouts, new Set(['missing']))).toBe(layouts)
  expect(omitAgentCanvasTabPanes(layouts, new Set(['missing']))).toBe(layouts)
  const removed = omitAgentCanvasPaneKeys(layouts, new Set(['t:a']))
  expect(removed.projects.r.tabs[0]).toBe(editableProject.tabs[0])
  expect(removed.projects.r.tabs[1].edges).toEqual([])
  expect(removed.projects.r.tabs[1].cards).toEqual({ 't:b': { x: 280, y: 0 } })
  expect(omitAgentCanvasTabPanes(layouts, new Set(['t'])).projects.r.tabs[1].edges).toEqual([])
})

describe('coordinator persistence', () => {
  it('normalizes the coordinator and preserves it when a canvas tab closes', () => {
    const layouts = normalizeAgentCanvasLayouts({
      projects: {
        r: {
          coordinatorPaneKey: 'chat:root',
          tabs: [{ id: 'extra', name: 'Extra', cards: {} }],
          activeTabId: 'extra'
        }
      }
    })
    expect(layouts.projects.r.coordinatorPaneKey).toBe('chat:root')
    expect(removeAgentCanvasTab(layouts.projects.r, 'extra').coordinatorPaneKey).toBe('chat:root')
  })

  it('unlinks removed coordinators even before their card is placed, preserving unrelated identity', () => {
    const layouts = {
      projects: {
        r: { ...emptyAgentCanvasProject(), coordinatorPaneKey: 'chat:root' },
        other: emptyAgentCanvasProject()
      }
    }
    expect(omitAgentCanvasPaneKeys(layouts, new Set(['missing']))).toBe(layouts)
    const next = omitAgentCanvasPaneKeys(layouts, new Set(['chat:root']))
    expect(next.projects.r.coordinatorPaneKey).toBeUndefined()
    expect(next.projects.other).toBe(layouts.projects.other)
    expect(layouts.projects.r.coordinatorPaneKey).toBe('chat:root')
    expect(
      omitAgentCanvasTabPanes(layouts, new Set(['chat'])).projects.r.coordinatorPaneKey
    ).toBeUndefined()
  })
})
