import { AGENT_CANVAS_CARD_WIDTH, type AgentCanvasProjectLayout } from './agent-canvas-layout'

export function placeAgentCanvasRow(
  project: AgentCanvasProjectLayout,
  tabId: string,
  paneKeys: readonly string[]
): AgentCanvasProjectLayout {
  const target = project.tabs.find((tab) => tab.id === tabId)
  const keys = [...new Set(paneKeys)]
  if (!target || !keys.length) {
    return project
  }
  const moving = new Set(keys)
  const points = Object.entries(target.cards)
    .filter(([key]) => !moving.has(key))
    .map(([, point]) => point)
  const x = points.length
    ? Math.max(...points.map((point) => point.x)) + (AGENT_CANVAS_CARD_WIDTH + 32)
    : 0
  const y = points.length ? Math.min(...points.map((point) => point.y)) : 0
  return {
    ...project,
    tabs: project.tabs.map((tab) => ({
      ...tab,
      cards: {
        ...Object.fromEntries(Object.entries(tab.cards).filter(([key]) => !moving.has(key))),
        ...(tab.id === tabId
          ? Object.fromEntries(
              keys.map((key, index) => [key, { x: x + index * (AGENT_CANVAS_CARD_WIDTH + 32), y }])
            )
          : {})
      }
    }))
  }
}
