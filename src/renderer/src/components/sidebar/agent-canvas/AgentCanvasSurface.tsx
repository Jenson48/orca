import { useCanvasEdges, canvasEdgeTypes } from './use-canvas-edges'
import { canvasKeyboard } from './use-canvas-history'
import { createNonSecureContextUuid as createBrowserUuid } from '../../../../../shared/non-secure-context-uuid'
import { ZoomControls } from './CanvasZoomControls'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  MarkerType,
  MiniMap,
  useNodesInitialized,
  Panel,
  ReactFlow,
  applyNodeChanges,
  useReactFlow,
  type Edge,
  type NodeChange
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useAppStore } from '@/store'
import { useTranslate } from '@/i18n/use-translate'
import type { AgentPaneThread } from '@/components/activity/activity-thread-types'
import { resolveChildWorktreeRepository } from '@/lib/workspace/creation/child-worktree-composer'
import { canCreateChildWorktree } from '@/components/sidebar/workspace-actions/context-menu/worktree-context-menu-policy'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../../shared/execution-host'
import type { AgentCanvasTab, AgentCanvasViewport } from '../../../../../shared/agent-canvas-layout'
import { AgentCanvasCard, type AgentCanvasCardData, type AgentCanvasNode } from './AgentCanvasCard'
import { isEditableTarget } from '@/lib/editable-target'
import { needsAgentCanvasAttention, agentCanvasWorkspaceColor } from './agent-canvas-appearance'

import { CanvasItemNode, type CanvasItem } from './CanvasItemNode'
import { CanvasCreateToolbar } from './CanvasCreateToolbar'

type CanvasNode = AgentCanvasNode | CanvasItem
const nodeTypes = { agent: AgentCanvasCard, text: CanvasItemNode, frame: CanvasItemNode }

export function CanvasSurface(props: {
  onRestore?: (redo: boolean) => void
  onEditTab?: (update: (tab: AgentCanvasTab) => AgentCanvasTab) => void
  onAttentionHandled?: () => void
  attentionKey?: string | null
  onNextAttention?: () => void
  tab: AgentCanvasTab
  tabs: AgentCanvasTab[]
  threads: AgentPaneThread[]
  lineage: ReturnType<typeof useAppStore.getState>['worktreeLineageById']
  onSelect: (thread: AgentPaneThread) => void
  onJump: (thread: AgentPaneThread) => void
  onFork: (thread: AgentPaneThread) => void
  onAddAgent?: () => void
  onMoveCards: (moved: Record<string, { x: number; y: number }>) => void
  onMoveToTab: (paneKey: string, tabId: string) => void
  onViewport: (viewport: AgentCanvasViewport) => void
}): React.JSX.Element {
  const t = useTranslate()
  const { tab, threads, lineage } = props
  const [editingId, setEditingId] = useState<string | null>(null)
  const threadByPane = useMemo(() => new Map(threads.map((x) => [x.paneKey, x])), [threads])
  const repos = useAppStore((s) => s.repos)
  const projectHostSetups = useAppStore((s) => s.projectHostSetups)
  const otherTabs = useMemo(
    () => props.tabs.filter((x) => x.id !== tab.id).map((x) => ({ id: x.id, name: x.name })),
    [props.tabs, tab.id]
  )

  const built = useMemo<CanvasNode[]>(() => {
    const nodes: CanvasNode[] = []
    for (const [paneKey, position] of Object.entries(tab.cards)) {
      const thread = threadByPane.get(paneKey)
      if (!thread) {
        continue
      }
      const hostId = thread.worktree.hostId ?? LOCAL_EXECUTION_HOST_ID
      const childRepo = resolveChildWorktreeRepository(repos, thread.worktree)
      const data: AgentCanvasCardData = {
        thread,
        hostId,
        canFork: canCreateChildWorktree({
          repo: childRepo,
          folderWorkspaceId: null,
          worktree: thread.worktree
        }),
        otherTabs,
        onFork: props.onFork,
        onJump: props.onJump,
        onMoveToTab: props.onMoveToTab
      }
      nodes.push({ id: paneKey, type: 'agent', position, data })
    }
    for (const [id, item] of Object.entries(tab.items ?? {})) {
      nodes.push({
        id: `item:${id}`,
        type: item.type,
        position: { x: item.x, y: item.y },
        style: {
          width: item.width ?? 248,
          height: item.type === 'frame' ? (item.height ?? 200) : undefined
        },
        zIndex: item.type === 'frame' ? -1 : 0,
        selected: editingId === id,
        data: {
          item,
          editing: editingId === id && item.type === 'text',
          finish: () => setEditingId(null),
          update: (patch) =>
            props.onEditTab?.((current) => ({
              ...current,
              items: { ...current.items, [id]: { ...current.items![id], ...patch } }
            })),
          remove: () =>
            props.onEditTab?.((current) => ({
              ...current,
              items: Object.fromEntries(
                Object.entries(current.items ?? {}).filter(([key]) => key !== id)
              ),
              edges: current.edges?.filter(
                (edge) => edge.source !== `item:${id}` && edge.target !== `item:${id}`
              )
            }))
        }
      })
    }
    return nodes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tab.cards,
    tab.items,
    editingId,
    threadByPane,
    repos,
    projectHostSetups,
    otherTabs,
    props.onEditTab
  ])

  // React Flow owns drag and selection state; the layout stays the source of positions.
  const [nodes, setNodes] = useState<CanvasNode[]>(built)
  useEffect(() => {
    setNodes((prev) => {
      const old = new Map(prev.map((n) => [n.id, n]))
      return built.map((n) => {
        const o = old.get(n.id)
        return o
          ? {
              ...n,
              selected: n.selected || o.selected,
              ...(o.dragging ? { position: o.position, dragging: true } : {})
            }
          : n
      })
    })
  }, [built])
  useEffect(() => {
    if (editingId && tab.items?.[editingId]?.type === 'frame') {
      setEditingId(null)
    }
  }, [editingId, tab.items])
  const onNodesChange = useCallback(
    (changes: NodeChange<CanvasNode>[]) =>
      setNodes((ns) =>
        applyNodeChanges(
          changes.filter((c) => c.type !== 'remove'),
          ns
        )
      ),
    []
  )

  // Fork lines follow Orca's workspace lineage: parent workspace's agent -> child workspace's agent.
  const edges = useMemo<Edge[]>(() => {
    const onTab = Object.keys(tab.cards)
      .map((k) => threadByPane.get(k))
      .filter((x): x is AgentPaneThread => !!x)
    const firstByWorktree = new Map<string, string>()
    for (const x of onTab) {
      if (!firstByWorktree.has(x.worktree.id)) {
        firstByWorktree.set(x.worktree.id, x.paneKey)
      }
    }
    const result: Edge[] = []
    for (const x of onTab) {
      const parentId = lineage[x.worktree.id]?.parentWorktreeId
      const source = parentId ? firstByWorktree.get(parentId) : undefined
      if (source && firstByWorktree.get(x.worktree.id) === x.paneKey) {
        result.push({
          id: `${source}->${x.paneKey}`,
          source,
          target: x.paneKey,
          selectable: false,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { strokeDasharray: '6 4' }
        })
      }
    }
    return result
  }, [tab.cards, threadByPane, lineage])

  const flow = useReactFlow<CanvasNode>()
  const userEdges = useCanvasEdges(tab, nodes, props.onEditTab)
  const initialized = useNodesInitialized()
  const { attentionKey, onAttentionHandled } = props
  useEffect(() => {
    if (!initialized || !attentionKey || !flow.getNode(attentionKey)) {
      return
    }
    setNodes((ns) => ns.map((n) => ({ ...n, selected: n.id === attentionKey })))
    void flow.fitView({ nodes: [{ id: attentionKey }], maxZoom: 1, padding: 0.5 })
    onAttentionHandled?.()
  }, [attentionKey, onAttentionHandled, initialized, flow])
  const placedCount = built.length

  return (
    <div
      className="relative min-h-0 flex-1 @container"
      tabIndex={0}
      onKeyDown={(event) => {
        if (canvasKeyboard(event, userEdges.removeSelected, props.onRestore)) {
          return
        }
        if (
          event.code === 'KeyN' &&
          event.altKey &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.shiftKey &&
          !event.repeat &&
          !isEditableTarget(event.target) &&
          props.onNextAttention
        ) {
          event.preventDefault()
          event.stopPropagation()
          props.onNextAttention()
        }
      }}
    >
      <ReactFlow<CanvasNode>
        nodes={nodes}
        edges={[...edges, ...userEdges.edges]}
        edgeTypes={canvasEdgeTypes}
        onEdgesChange={userEdges.onEdgesChange}
        onConnect={userEdges.connect}
        isValidConnection={userEdges.valid}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeClick={(_, node) => {
          if (node.type === 'agent') {
            props.onSelect(node.data.thread)
          }
        }}
        onNodeDragStop={(_, __, dragged) => {
          props.onEditTab?.((current) => ({
            ...current,
            cards: {
              ...current.cards,
              ...Object.fromEntries(
                dragged.filter((n) => n.type === 'agent').map((n) => [n.id, n.position])
              )
            },
            items: {
              ...current.items,
              ...Object.fromEntries(
                dragged
                  .filter((n) => n.type !== 'agent')
                  .map((n) => [n.id.slice(5), { ...current.items![n.id.slice(5)], ...n.position }])
              )
            }
          }))
        }}
        defaultViewport={tab.viewport ?? { x: 24, y: 24, zoom: 0.9 }}
        fitView={!tab.viewport && placedCount > 0}
        fitViewOptions={{ maxZoom: 1, padding: 0.2 }}
        onMoveEnd={(_, viewport) => props.onViewport(viewport)}
        minZoom={0.2}
        maxZoom={2}
        nodesConnectable
        deleteKeyCode={null}
        proOptions={{ hideAttribution: true }}
        className="bg-worktree-sidebar"
      >
        <MiniMap
          className="hidden @[520px]:block"
          pannable
          zoomable
          style={{
            width: 120,
            height: 80,
            background: 'var(--card)',
            border: '1px solid var(--border)'
          }}
          maskColor="color-mix(in srgb, var(--background) 70%, transparent)"
          nodeColor={(node) => {
            const thread = threadByPane.get(node.id)
            return thread && needsAgentCanvasAttention(thread)
              ? 'var(--status-warning)'
              : thread
                ? agentCanvasWorkspaceColor(thread.worktree.id)
                : 'var(--muted)'
          }}
        />
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="var(--border)" />
        <Panel position="top-left">
          <CanvasCreateToolbar
            onAgent={props.onAddAgent}
            onCreate={(type) => {
              const bounds = flow.getViewport()
              const element = document.querySelector('.react-flow')?.getBoundingClientRect()
              let x = ((element?.width ?? 640) / 2 - bounds.x) / bounds.zoom
              let y = ((element?.height ?? 480) / 2 - bounds.y) / bounds.zoom
              while (
                nodes.some(
                  (node) =>
                    Math.abs(node.position.x - x) < 280 && Math.abs(node.position.y - y) < 160
                )
              ) {
                x += 32
                y += 40
              }
              const id = createBrowserUuid()
              setEditingId(id)
              props.onEditTab?.((current) => ({
                ...current,
                items: {
                  ...current.items,
                  [id]: {
                    type,
                    x,
                    y,
                    text: t(
                      type === 'text' ? 'agentCanvas.text' : 'agentCanvas.area',
                      type === 'text' ? 'Text' : 'Area'
                    ),
                    ...(type === 'text'
                      ? { style: 'heading' }
                      : { width: 560, height: 240, color: 'sky' })
                  }
                }
              }))
            }}
          />
        </Panel>
        <Panel position="top-right">
          <ZoomControls onNextAttention={props.onNextAttention} />
        </Panel>
        {placedCount === 0 ? (
          <Panel
            position="top-center"
            className="mt-14 max-w-64 rounded-md border border-dashed border-border bg-card px-3 py-2 text-center text-xs text-muted-foreground"
          >
            {threads.length === 0
              ? t(
                  'agentCanvas.emptyProject',
                  'No agents in this project yet. Start one with + Agent.'
                )
              : t('agentCanvas.emptyTab', 'This tab is empty. Move cards here from another tab.')}
          </Panel>
        ) : null}
      </ReactFlow>
    </div>
  )
}
