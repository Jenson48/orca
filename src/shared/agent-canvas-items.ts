import type { AgentCanvasItem, AgentCanvasEdge, AgentCanvasTab } from './agent-canvas-layout'
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

export function normalizeItems(value: unknown): Record<string, AgentCanvasItem> {
  const items: Record<string, AgentCanvasItem> = {}
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return items
  }
  for (const [id, raw] of Object.entries(value)) {
    const point =
      raw && typeof raw === 'object' && isFiniteNumber(raw.x) && isFiniteNumber(raw.y)
        ? { x: raw.x as number, y: raw.y as number }
        : null
    if (!id || !point || !raw || typeof raw !== 'object') {
      continue
    }
    const item = raw as Record<string, unknown>
    if (
      (item.type !== 'text' && item.type !== 'frame') ||
      typeof item.text !== 'string' ||
      (item.style !== undefined && item.style !== 'heading' && item.style !== 'body') ||
      (item.color !== undefined && typeof item.color !== 'string') ||
      ['width', 'height'].some(
        (key) => item[key] !== undefined && (!isFiniteNumber(item[key]) || item[key] <= 0)
      )
    ) {
      continue
    }
    items[id] = {
      ...point,
      type: item.type,
      text: item.text,
      ...(item.width !== undefined ? { width: item.width as number } : {}),
      ...(item.height !== undefined ? { height: item.height as number } : {}),
      ...(item.style !== undefined ? { style: item.style } : {}),
      ...(item.color !== undefined ? { color: item.color as string } : {})
    }
  }
  return items
}

export function normalizeEdges(
  value: unknown,
  cards: AgentCanvasTab['cards'],
  items: Record<string, AgentCanvasItem>
): AgentCanvasEdge[] {
  const edges: AgentCanvasEdge[] = []
  const exists = (id: string): boolean =>
    id.startsWith('agent:')
      ? Object.hasOwn(cards, id.slice(6))
      : id.startsWith('item:') &&
        Object.hasOwn(items, id.slice(5)) &&
        items[id.slice(5)].type === 'text'
  for (const raw of Array.isArray(value) ? value : []) {
    if (!raw || typeof raw !== 'object') {
      continue
    }
    const e = raw as Record<string, unknown>
    if (
      typeof e.id !== 'string' ||
      !e.id ||
      typeof e.source !== 'string' ||
      typeof e.target !== 'string' ||
      e.source === e.target ||
      !exists(e.source) ||
      !exists(e.target) ||
      (e.label !== undefined && typeof e.label !== 'string') ||
      edges.some(
        (other) => other.id === e.id || (other.source === e.source && other.target === e.target)
      )
    ) {
      continue
    }
    edges.push({
      id: e.id,
      source: e.source,
      target: e.target,
      ...(typeof e.label === 'string' ? { label: e.label } : {})
    })
  }
  return edges
}

export function omitEdges(
  tab: AgentCanvasTab,
  doomed: (key: string) => boolean
): Pick<AgentCanvasTab, 'edges'> {
  return tab.edges
    ? {
        edges: tab.edges.filter(
          (edge) =>
            ![edge.source, edge.target].some((id) => id.startsWith('agent:') && doomed(id.slice(6)))
        )
      }
    : {}
}
