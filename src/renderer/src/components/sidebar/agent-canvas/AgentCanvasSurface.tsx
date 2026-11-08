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
  useViewport,
  type Edge,
  type NodeChange
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Bell, Minus, Plus } from 'lucide-react'
import { useAppStore } from '@/store'
import { useTranslate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'
import type { AgentPaneThread } from '@/components/activity/activity-thread-types'
import { resolveChildWorktreeRepository } from '@/lib/workspace/creation/child-worktree-composer'
import { canCreateChildWorktree } from '@/components/sidebar/workspace-actions/context-menu/worktree-context-menu-policy'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../../shared/execution-host'
import type { AgentCanvasTab, AgentCanvasViewport } from '../../../../../shared/agent-canvas-layout'
import { AgentCanvasCard, type AgentCanvasCardData, type AgentCanvasNode } from './AgentCanvasCard'
import { getShortcutPlatform } from '@/hooks/useShortcutLabel'
import { formatKeybinding } from '../../../../../shared/keybindings'
import { ShortcutKeyCombo } from '@/components/ShortcutKeyCombo'
import { isEditableTarget } from '@/lib/editable-target'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { needsAgentCanvasAttention, agentCanvasWorkspaceColor } from './agent-canvas-appearance'

const nodeTypes = { agent: AgentCanvasCard }

export function CanvasSurface(props: {
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
  const threadByPane = useMemo(() => new Map(threads.map((x) => [x.paneKey, x])), [threads])
  const repos = useAppStore((s) => s.repos)
  const projectHostSetups = useAppStore((s) => s.projectHostSetups)
  const otherTabs = useMemo(
    () => props.tabs.filter((x) => x.id !== tab.id).map((x) => ({ id: x.id, name: x.name })),
    [props.tabs, tab.id]
  )

  const built = useMemo<AgentCanvasNode[]>(() => {
    const nodes: AgentCanvasNode[] = []
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
    return nodes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.cards, threadByPane, repos, projectHostSetups, otherTabs])

  // React Flow owns drag and selection state; the layout stays the source of positions.
  const [nodes, setNodes] = useState<AgentCanvasNode[]>(built)
  useEffect(() => {
    setNodes((prev) => {
      const old = new Map(prev.map((n) => [n.id, n]))
      return built.map((n) => {
        const o = old.get(n.id)
        return o
          ? {
              ...n,
              selected: o.selected,
              ...(o.dragging ? { position: o.position, dragging: true } : {})
            }
          : n
      })
    })
  }, [built])
  const onNodesChange = useCallback(
    (changes: NodeChange<AgentCanvasNode>[]) =>
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

  const flow = useReactFlow<AgentCanvasNode>()
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
      className="relative min-h-0 flex-1"
      tabIndex={0}
      onKeyDown={(event) => {
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
      <ReactFlow<AgentCanvasNode>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeClick={(_, node) => props.onSelect(node.data.thread)}
        onNodeDragStop={(_, __, dragged) =>
          props.onMoveCards(Object.fromEntries(dragged.map((n) => [n.id, n.position])))
        }
        defaultViewport={tab.viewport ?? { x: 24, y: 24, zoom: 0.9 }}
        fitView={!tab.viewport && placedCount > 0}
        fitViewOptions={{ maxZoom: 1, padding: 0.2 }}
        onMoveEnd={(_, viewport) => props.onViewport(viewport)}
        minZoom={0.2}
        maxZoom={2}
        nodesConnectable={false}
        deleteKeyCode={null}
        proOptions={{ hideAttribution: true }}
        className="bg-worktree-sidebar"
      >
        <MiniMap
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
        {props.onAddAgent ? (
          <Panel position="top-left">
            <Button size="sm" className="h-7 gap-1 text-xs" onClick={props.onAddAgent}>
              <Plus className="size-3.5" />
              {t('agentCanvas.addAgent', 'Agent')}
            </Button>
          </Panel>
        ) : null}
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

function ZoomControls({ onNextAttention }: { onNextAttention?: () => void }): React.JSX.Element {
  const t = useTranslate()
  const flow = useReactFlow()
  const { zoom } = useViewport()
  return (
    <div className="flex items-center rounded-md border border-border bg-card font-mono text-[11px] shadow-xs">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={!onNextAttention}
            onClick={onNextAttention}
            aria-label={t('agentCanvas.nextAttention', 'Next agent needing me')}
          >
            <Bell className="size-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          {t('agentCanvas.nextAttention', 'Next agent needing me')}
          <ShortcutKeyCombo
            className="ml-2"
            keys={formatKeybinding('Alt+N', getShortcutPlatform())}
          />
        </TooltipContent>
      </Tooltip>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={t('agentCanvas.zoomOut', 'Zoom out')}
        onClick={() => void flow.zoomOut({ duration: 150 })}
      >
        <Minus className="size-3" />
      </Button>
      <span className="w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={t('agentCanvas.zoomIn', 'Zoom in')}
        onClick={() => void flow.zoomIn({ duration: 150 })}
      >
        <Plus className="size-3" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="rounded-l-none border-l border-border px-2 font-mono text-[11px]"
        onClick={() => void flow.fitView({ duration: 200, maxZoom: 1, padding: 0.2 })}
      >
        {t('agentCanvas.fit', 'Fit')}
      </Button>
    </div>
  )
}
