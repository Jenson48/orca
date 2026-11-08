import { useState } from 'react'
import { MarkerType, type Connection, type Edge, type EdgeChange, type Node } from '@xyflow/react'
import type { AgentCanvasTab } from '../../../../../shared/agent-canvas-layout'
import { createNonSecureContextUuid } from '../../../../../shared/non-secure-context-uuid'
import { CanvasUserEdge } from './CanvasUserEdge'
export const canvasEdgeTypes = { user: CanvasUserEdge }
export function useCanvasEdges(
  tab: AgentCanvasTab,
  nodes: Node[],
  edit?: (update: (tab: AgentCanvasTab) => AgentCanvasTab) => void
) {
  const [selected, setSelected] = useState<string[]>([])
  const endpoint = (id: string): string =>
    nodes.find((n) => n.id === id)?.type === 'agent' ? `agent:${id}` : id
  const renderId = (id: string): string => (id.startsWith('agent:') ? id.slice(6) : id)
  const edges: Edge[] = (tab.edges ?? []).map((edge) => ({
    id: `user:${edge.id}`,
    source: renderId(edge.source),
    target: renderId(edge.target),
    type: 'user',
    selected: selected.includes(`user:${edge.id}`),
    markerEnd: { type: MarkerType.ArrowClosed },
    data: {
      text: edge.label ?? '',
      commit: (label: string) =>
        edit?.((current) => ({
          ...current,
          edges: current.edges?.map((e) => (e.id === edge.id ? { ...e, label } : e))
        })),
      remove: () =>
        edit?.((current) => ({ ...current, edges: current.edges?.filter((e) => e.id !== edge.id) }))
    }
  }))
  const valid = (connection: Connection | Edge): boolean => {
    const source = nodes.find((n) => n.id === connection.source)
    const target = nodes.find((n) => n.id === connection.target)
    return (
      !!source &&
      !!target &&
      source.type !== 'frame' &&
      target.type !== 'frame' &&
      source.id !== target.id &&
      !(tab.edges ?? []).some(
        (e) => e.source === endpoint(source.id) && e.target === endpoint(target.id)
      )
    )
  }
  return {
    edges,
    valid,
    onEdgesChange: (changes: EdgeChange[]) =>
      setSelected((previous) => {
        let next = previous
        for (const change of changes) {
          if (change.type === 'select') {
            next = change.selected ? [...next, change.id] : next.filter((id) => id !== change.id)
          }
        }
        return next
      }),
    connect: (connection: Connection) => {
      if (!valid(connection)) {
        return
      }
      edit?.((current) => ({
        ...current,
        edges: [
          ...(current.edges ?? []),
          {
            id: createNonSecureContextUuid(),
            source: endpoint(connection.source),
            target: endpoint(connection.target)
          }
        ]
      }))
    },
    removeSelected: () =>
      edit?.((current) => {
        const ids = new Set(nodes.filter((n) => n.selected && n.type !== 'agent').map((n) => n.id))
        if (ids.size === 0 && selected.length === 0) {
          return current
        }
        return {
          ...current,
          items: Object.fromEntries(
            Object.entries(current.items ?? {}).filter(([id]) => !ids.has(`item:${id}`))
          ),
          edges: current.edges?.filter(
            (e) => !selected.includes(`user:${e.id}`) && !ids.has(e.source) && !ids.has(e.target)
          )
        }
      })
  }
}
