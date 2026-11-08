import { normalizeItems, normalizeEdges, omitEdges } from './agent-canvas-items'

/** Agent canvas layout: per project, user-named tabs holding agent cards at canvas positions. */

export type AgentCanvasPoint = { x: number; y: number }
export type AgentCanvasViewport = { x: number; y: number; zoom: number }

export type AgentCanvasItem = AgentCanvasPoint & {
  type: 'text' | 'frame'
  text: string
  width?: number
  height?: number
  style?: 'heading' | 'body'
  color?: string
}
export type AgentCanvasEdge = { id: string; source: string; target: string; label?: string }

export type AgentCanvasTab = {
  id: string
  name: string
  /** Card positions keyed by agent pane key; a pane sits on at most one tab. */
  cards: Record<string, AgentCanvasPoint>
  items?: Record<string, AgentCanvasItem>
  edges?: AgentCanvasEdge[]
  viewport?: AgentCanvasViewport
}

export type AgentCanvasProjectLayout = {
  coordinatorPaneKey?: string
  tabs: AgentCanvasTab[]
  activeTabId: string
}

export type AgentCanvasLayouts = {
  /** Project shown when the active workspace does not pick one. */
  repoId?: string | null
  /** Sidebar width while the canvas is showing; the list keeps its own narrower width. */
  width?: number
  projects: Record<string, AgentCanvasProjectLayout>
}

export const AGENT_CANVAS_MAIN_TAB_ID = 'main'
export const AGENT_CANVAS_CARD_WIDTH = 248
export const AGENT_CANVAS_CARD_HEIGHT = 132
const GRID_X = AGENT_CANVAS_CARD_WIDTH + 32
const GRID_Y = AGENT_CANVAS_CARD_HEIGHT + 40
const GRID_COLUMNS = 3

export const AGENT_CANVAS_MIN_WIDTH = 360
export const AGENT_CANVAS_DEFAULT_WIDTH = 640
export const AGENT_CANVAS_MAX_WIDTH = 2400

export function emptyAgentCanvasProject(): AgentCanvasProjectLayout {
  return {
    tabs: [{ id: AGENT_CANVAS_MAIN_TAB_ID, name: 'Main', cards: {} }],
    activeTabId: AGENT_CANVAS_MAIN_TAB_ID
  }
}

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function normalizePoint(v: unknown): AgentCanvasPoint | null {
  if (!v || typeof v !== 'object') {
    return null
  }
  const p = v as Record<string, unknown>
  return isFiniteNumber(p.x) && isFiniteNumber(p.y) ? { x: p.x, y: p.y } : null
}

function normalizeViewport(v: unknown): AgentCanvasViewport | undefined {
  const p = normalizePoint(v)
  const zoom = (v as Record<string, unknown> | null)?.zoom
  return p && isFiniteNumber(zoom) && zoom > 0 ? { ...p, zoom } : undefined
}

function normalizeProject(v: unknown): AgentCanvasProjectLayout {
  const raw = v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
  const seenPanes = new Set<string>()
  const tabs: AgentCanvasTab[] = []
  for (const t of Array.isArray(raw.tabs) ? raw.tabs : []) {
    if (!t || typeof t !== 'object') {
      continue
    }
    const tab = t as Record<string, unknown>
    if (typeof tab.id !== 'string' || !tab.id || tabs.some((x) => x.id === tab.id)) {
      continue
    }
    const cards: Record<string, AgentCanvasPoint> = {}
    const rawCards = tab.cards && typeof tab.cards === 'object' ? tab.cards : {}
    for (const [paneKey, point] of Object.entries(rawCards)) {
      const p = normalizePoint(point)
      if (p && !seenPanes.has(paneKey)) {
        seenPanes.add(paneKey)
        cards[paneKey] = p
      }
    }
    const viewport = normalizeViewport(tab.viewport)
    const items = normalizeItems(tab.items)
    tabs.push({
      id: tab.id,
      name: typeof tab.name === 'string' && tab.name.trim() ? tab.name : 'Untitled',
      cards,
      ...(tab.items !== undefined ? { items } : {}),
      ...(tab.edges !== undefined ? { edges: normalizeEdges(tab.edges, cards, items) } : {}),
      ...(viewport ? { viewport } : {})
    })
  }
  if (!tabs.some((t) => t.id === AGENT_CANVAS_MAIN_TAB_ID)) {
    tabs.unshift(emptyAgentCanvasProject().tabs[0])
  }
  const activeTabId =
    typeof raw.activeTabId === 'string' && tabs.some((t) => t.id === raw.activeTabId)
      ? raw.activeTabId
      : AGENT_CANVAS_MAIN_TAB_ID
  return {
    tabs,
    activeTabId,
    ...(typeof raw.coordinatorPaneKey === 'string' && raw.coordinatorPaneKey
      ? { coordinatorPaneKey: raw.coordinatorPaneKey }
      : {})
  }
}

export function normalizeAgentCanvasLayouts(v: unknown): AgentCanvasLayouts {
  const raw = v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
  const projects: Record<string, AgentCanvasProjectLayout> = {}
  const rawProjects = raw.projects && typeof raw.projects === 'object' ? raw.projects : {}
  for (const [repoId, project] of Object.entries(rawProjects)) {
    projects[repoId] = normalizeProject(project)
  }
  return {
    repoId: typeof raw.repoId === 'string' ? raw.repoId : null,
    ...(isFiniteNumber(raw.width) ? { width: clampAgentCanvasWidth(raw.width) } : {}),
    projects
  }
}

export function clampAgentCanvasWidth(width: number): number {
  return Math.min(AGENT_CANVAS_MAX_WIDTH, Math.max(AGENT_CANVAS_MIN_WIDTH, Math.round(width)))
}

function overlaps(a: AgentCanvasPoint, b: AgentCanvasPoint): boolean {
  return (
    Math.abs(a.x - b.x) < AGENT_CANVAS_CARD_WIDTH + 8 &&
    Math.abs(a.y - b.y) < AGENT_CANVAS_CARD_HEIGHT + 8
  )
}

/** First free grid slot, or the first free slot to the right of `near` (a fork's parent card). */
export function findFreeAgentCanvasSlot(
  taken: readonly AgentCanvasPoint[],
  near?: AgentCanvasPoint
): AgentCanvasPoint {
  if (near) {
    for (let row = 0; row < 50; row++) {
      const p = { x: near.x + GRID_X, y: near.y + row * GRID_Y }
      if (!taken.some((t) => overlaps(t, p))) {
        return p
      }
    }
  }
  for (let i = 0; ; i++) {
    const p = { x: (i % GRID_COLUMNS) * GRID_X, y: Math.floor(i / GRID_COLUMNS) * GRID_Y }
    if (!taken.some((t) => overlaps(t, p))) {
      return p
    }
  }
}

export type AgentCanvasPlacementRequest = {
  paneKey: string
  /** Pane keys whose cards a new card should sit beside (agents in its worktree's parent). */
  nearPaneKeys: readonly string[]
}

/** Places new cards beside the first available relative, falling back to the open tab. */
export function placeNewAgentCanvasCards(
  project: AgentCanvasProjectLayout,
  tabId: string,
  requests: readonly AgentCanvasPlacementRequest[]
): AgentCanvasProjectLayout | null {
  const placed = new Set(project.tabs.flatMap((t) => Object.keys(t.cards)))
  const pending = requests.filter((r) => !placed.has(r.paneKey))
  const target = project.tabs.find((t) => t.id === tabId)
  if (pending.length === 0 || !target) {
    return null
  }
  const tabs = [...project.tabs]
  const changed = new Set<string>()
  for (const r of pending) {
    const relative = r.nearPaneKeys
      .map((key) => ({ key, tab: tabs.find((t) => key in t.cards) }))
      .find((entry) => entry.tab)
    let destination = relative?.tab ?? tabs.find((t) => t.id === tabId)!
    if (!changed.has(destination.id)) {
      const index = tabs.indexOf(destination)
      destination = { ...destination, cards: { ...destination.cards } }
      tabs[index] = destination
      changed.add(destination.id)
    }
    destination.cards[r.paneKey] = findFreeAgentCanvasSlot(
      Object.values(destination.cards),
      relative ? destination.cards[relative.key] : undefined
    )
  }
  return { ...project, tabs }
}

/** Moves cards to another tab, keeping their positions free of overlaps there. */
export function moveAgentCanvasCards(
  project: AgentCanvasProjectLayout,
  paneKeys: readonly string[],
  toTabId: string
): AgentCanvasProjectLayout {
  const moving = new Set(paneKeys)
  const target = project.tabs.find((t) => t.id === toTabId)
  if (!target) {
    return project
  }
  const cards = { ...target.cards }
  for (const key of paneKeys) {
    if (!(key in cards)) {
      cards[key] = findFreeAgentCanvasSlot(Object.values(cards))
    }
  }
  return {
    ...project,
    tabs: project.tabs.map((t) => {
      if (t.id === toTabId) {
        return { ...t, cards }
      }
      const rest = Object.fromEntries(Object.entries(t.cards).filter(([k]) => !moving.has(k)))
      return { ...t, cards: rest, ...omitEdges(t, (key) => moving.has(key)) }
    })
  }
}

/** Removing a tab sends its cards back to Main rather than dropping them. */
export function removeAgentCanvasTab(
  project: AgentCanvasProjectLayout,
  tabId: string
): AgentCanvasProjectLayout {
  if (tabId === AGENT_CANVAS_MAIN_TAB_ID) {
    return project
  }
  const tab = project.tabs.find((t) => t.id === tabId)
  if (!tab) {
    return project
  }
  const moved = moveAgentCanvasCards(project, Object.keys(tab.cards), AGENT_CANVAS_MAIN_TAB_ID)
  const tabs = moved.tabs
    .filter((t) => t.id !== tabId)
    .map((t) =>
      t.id === AGENT_CANVAS_MAIN_TAB_ID
        ? {
            ...t,
            ...(tab.items ? { items: { ...t.items, ...tab.items } } : {}),
            ...(tab.edges ? { edges: [...(t.edges ?? []), ...tab.edges] } : {})
          }
        : t
    )
  return {
    ...project,
    tabs,
    activeTabId: project.activeTabId === tabId ? AGENT_CANVAS_MAIN_TAB_ID : project.activeTabId
  }
}

/** Drops cards whose pane belongs to a closed terminal tab; keeps identity when none match. */
export function omitAgentCanvasTabPanes<T extends AgentCanvasLayouts | undefined>(
  layouts: T,
  tabIds: ReadonlySet<string>
): T {
  if (tabIds.size === 0) {
    return layouts
  }
  return omitAgentCanvasCardsWhere(layouts, (paneKey) => {
    const sep = paneKey.indexOf(':')
    return sep > 0 && tabIds.has(paneKey.slice(0, sep))
  })
}

/** Drops the cards of removed panes; keeps identity when none match. */
export function omitAgentCanvasPaneKeys<T extends AgentCanvasLayouts | undefined>(
  layouts: T,
  paneKeys: ReadonlySet<string>
): T {
  return paneKeys.size === 0 ? layouts : omitAgentCanvasCardsWhere(layouts, (k) => paneKeys.has(k))
}

function omitAgentCanvasCardsWhere<T extends AgentCanvasLayouts | undefined>(
  layouts: T,
  doomed: (paneKey: string) => boolean
): T {
  if (!layouts) {
    return layouts
  }
  let changed = false
  const projects: Record<string, AgentCanvasProjectLayout> = {}
  for (const [repoId, project] of Object.entries(layouts.projects)) {
    let projectChanged = false
    const tabs = project.tabs.map((tab) => {
      if (!Object.keys(tab.cards).some(doomed)) {
        return tab
      }
      projectChanged = true
      return {
        ...tab,
        cards: Object.fromEntries(Object.entries(tab.cards).filter(([k]) => !doomed(k))),
        ...omitEdges(tab, doomed)
      }
    })
    const removeCoordinator = !!project.coordinatorPaneKey && doomed(project.coordinatorPaneKey)
    projectChanged ||= removeCoordinator
    const next = projectChanged ? { ...project, tabs } : project
    if (removeCoordinator) {
      delete next.coordinatorPaneKey
    }
    projects[repoId] = next
    changed ||= projectChanged
  }
  return changed ? ({ ...layouts, projects } as T) : layouts
}
