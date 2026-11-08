import { ReactFlowProvider } from '@xyflow/react'
import { defineFixture } from '../../../component-fixtures/component-fixture'
import type { AgentPaneThread } from '@/components/activity/activity-thread-types'
import type { AgentCanvasProjectLayout } from '../../../../../shared/agent-canvas-layout'
import type { WorktreeLineage } from '../../../../../shared/worktree/lineage-types'
import { CanvasSurface } from './AgentCanvasSurface'
import { CanvasTabStrip } from './AgentCanvasTabStrip'

function thread(args: {
  paneKey: string
  title: string
  worktree: string
  agentType: 'claude' | 'codex'
  state: AgentPaneThread['currentAgentState']
  preview: string
}): AgentPaneThread {
  const worktreeId = `fixture-repo::/projects/${args.worktree}`
  return {
    paneKey: args.paneKey,
    paneTitle: args.title,
    worktree: {
      id: worktreeId,
      repoId: 'fixture-repo',
      path: `/projects/${args.worktree}`,
      head: 'abc123',
      branch: args.worktree,
      isBare: false,
      isMainWorktree: args.worktree === 'mint',
      displayName: args.worktree,
      comment: '',
      linkedIssue: null,
      linkedPR: null,
      linkedLinearIssue: null,
      isArchived: false,
      isUnread: false,
      isPinned: false,
      sortOrder: 0,
      lastActivityAt: 0
    },
    repo: null,
    tab: {
      id: `${args.paneKey}-tab`,
      ptyId: null,
      worktreeId,
      title: args.title,
      customTitle: null,
      color: null,
      sortOrder: 0,
      createdAt: 0
    },
    agentType: args.agentType,
    currentAgentState: args.state,
    currentAgentEntry: null,
    responsePreview: args.preview,
    latestTimestamp: Date.now() - 60_000,
    latestEvent: null,
    events: [],
    unread: args.state === 'waiting'
  }
}

const threads = [
  thread({
    paneKey: 'exp1',
    title: 'Exp1',
    worktree: 'mint',
    agentType: 'codex',
    state: null,
    preview: 'Finished the cache invalidation pass.'
  }),
  thread({
    paneKey: 'exp2',
    title: 'Exp2',
    worktree: 'exp-streaming',
    agentType: 'codex',
    state: 'working',
    preview: 'Running the integration tests.'
  }),
  thread({
    paneKey: 'fork',
    title: 'Fork: Exp2',
    worktree: 'exp-streaming-fork',
    agentType: 'codex',
    state: 'waiting',
    preview: 'Which retry policy should the client use?'
  })
]

const lineage = {
  'fixture-repo::/projects/exp-streaming-fork': {
    parentWorktreeId: 'fixture-repo::/projects/exp-streaming'
  } as WorktreeLineage
}

const project: AgentCanvasProjectLayout = {
  tabs: [
    {
      id: 'main',
      name: 'Main',
      cards: { exp1: { x: 0, y: 0 }, exp2: { x: 280, y: 0 }, fork: { x: 560, y: 0 } },
      items: {
        team: {
          type: 'frame',
          x: -12,
          y: -55,
          text: 'Team',
          width: 552,
          height: 220,
          color: 'sky'
        },
        heading: { type: 'text', x: 0, y: -100, text: 'Implementation', style: 'heading' }
      },
      viewport: { x: 16, y: 120, zoom: 0.85 }
    },
    { id: 'cfbfp', name: 'CFBFP', cards: {} }
  ],
  activeTabId: 'main'
}

function Canvas({ compact = false }: { compact?: boolean }): React.JSX.Element {
  return (
    <div className="flex h-[360px] flex-col bg-worktree-sidebar text-foreground">
      <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
        <span className="px-2 text-xs font-semibold">mint</span>
        <CanvasTabStrip
          project={project}
          onSelect={() => {}}
          onRename={() => {}}
          onClose={() => {}}
          onAdd={() => {}}
        />
      </div>
      <ReactFlowProvider>
        <CanvasSurface
          tab={{ ...project.tabs[0], viewport: { x: 16, y: 120, zoom: compact ? 0.5 : 0.85 } }}
          tabs={project.tabs}
          threads={threads}
          lineage={lineage}
          onSelect={() => {}}
          onJump={() => {}}
          onFork={() => {}}
          onAddAgent={() => {}}
          onMoveCards={() => {}}
          onMoveToTab={() => {}}
          onViewport={() => {}}
        />
      </ReactFlowProvider>
    </div>
  )
}

export const threeAgents = defineFixture({
  width: 760,
  render: () => <Canvas />
})

export const compactAgents = defineFixture({ width: 760, render: () => <Canvas compact /> })
