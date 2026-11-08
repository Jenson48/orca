import { CanvasCoordinator } from './CanvasCoordinator'
import { useCanvasHistory } from './use-canvas-history'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { useAppStore } from '@/store'
import { useTranslate } from '@/i18n/use-translate'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useAgentPaneThreads } from '@/components/activity/use-agent-pane-threads'
import { useActivityThreadActionBindings } from '@/components/activity/use-activity-thread-action-bindings'
import type { AgentPaneThread } from '@/components/activity/activity-thread-types'
import { getRepoWorkspaceCreationTargetHint } from '@/lib/project-host-workspace-target'
import { openChildWorktreeComposer } from '@/lib/workspace/creation/child-worktree-composer'
import {
  emptyAgentCanvasProject,
  moveAgentCanvasCards,
  placeNewAgentCanvasCards,
  removeAgentCanvasTab,
  type AgentCanvasProjectLayout,
  type AgentCanvasTab
} from '../../../../../shared/agent-canvas-layout'
import { CanvasTabStrip } from './AgentCanvasTabStrip'
import { CanvasProjectActions } from './CanvasProjectActions'
import { CanvasSurface } from './AgentCanvasSurface'
import { useIdleAgentCanvasThreads } from './use-idle-agent-canvas-threads'
import { needsAgentCanvasAttention } from './agent-canvas-appearance'

const noop = (): void => {}

/** Sidebar body that lays out one project's agents as cards on user-named canvas tabs. */
export default function AgentCanvas(): React.JSX.Element {
  const lastAttentionKey = useRef<string | null>(null)
  const [attentionKey, setAttentionKey] = useState<string | null>(null)
  const t = useTranslate()
  const { storeData, visibleThreads, markAllReadThreads } = useAgentPaneThreads({
    query: '',
    readFilter: 'all',
    groupBy: 'none',
    selectedPaneKey: null,
    showChildAgents: true
  })
  // Every agent including child workspaces' agents, regardless of the Activity view's scope filters, plus chats that have not started yet.
  const idleThreads = useIdleAgentCanvasThreads(markAllReadThreads)
  const threads = useMemo(
    () => (idleThreads.length > 0 ? [...markAllReadThreads, ...idleThreads] : markAllReadThreads),
    [markAllReadThreads, idleThreads]
  )
  const { selectThread, jumpToWorkspace } = useActivityThreadActionBindings({
    visibleThreads,
    markAllReadThreads,
    acknowledgeAgents: storeData.acknowledgeAgents,
    unacknowledgeAgents: storeData.unacknowledgeAgents,
    setSelectedPaneKey: noop
  })
  const layouts = useAppStore((s) => s.agentCanvas)
  const updateAgentCanvas = useAppStore((s) => s.updateAgentCanvas)
  const activeWorktreeId = useAppStore((s) => s.activeWorktreeId)
  const lineage = useAppStore((s) => s.worktreeLineageById)
  const repos = storeData.repos

  const activeRepoId = useMemo(() => {
    if (!activeWorktreeId) {
      return null
    }
    for (const [repoId, worktrees] of Object.entries(storeData.worktreesByRepo)) {
      if (worktrees.some((w) => w.id === activeWorktreeId)) {
        return repoId
      }
    }
    return null
  }, [activeWorktreeId, storeData.worktreesByRepo])

  const repoId = useMemo(() => {
    const known = (id: string | null | undefined): id is string =>
      !!id && repos.some((r) => r.id === id)
    if (known(layouts.repoId)) {
      return layouts.repoId
    }
    if (known(activeRepoId)) {
      return activeRepoId
    }
    return threads[0]?.worktree.repoId ?? repos[0]?.id ?? null
  }, [layouts.repoId, activeRepoId, threads, repos])
  const repo = repos.find((r) => r.id === repoId) ?? null

  const project: AgentCanvasProjectLayout = useMemo(
    () => (repoId ? layouts.projects[repoId] : undefined) ?? emptyAgentCanvasProject(),
    [layouts.projects, repoId]
  )
  const tab = project.tabs.find((x) => x.id === project.activeTabId) ?? project.tabs[0]

  const updateProject = useCallback(
    (update: (p: AgentCanvasProjectLayout) => AgentCanvasProjectLayout | null) => {
      if (!repoId) {
        return
      }
      updateAgentCanvas((l) => {
        const current = l.projects[repoId] ?? emptyAgentCanvasProject()
        const next = update(current)
        return next && next !== current ? { ...l, projects: { ...l.projects, [repoId]: next } } : l
      })
    },
    [repoId, updateAgentCanvas]
  )
  const history = useCanvasHistory(repoId, updateProject)
  const editTab = (id: string, update: (tab: AgentCanvasTab) => AgentCanvasTab): void =>
    history.commit((p) => ({ ...p, tabs: p.tabs.map((x) => (x.id === id ? update(x) : x)) }))
  const updateTab = useCallback(
    (tabId: string, update: (x: AgentCanvasTab) => AgentCanvasTab) =>
      updateProject((p) => ({ ...p, tabs: p.tabs.map((x) => (x.id === tabId ? update(x) : x)) })),
    [updateProject]
  )

  const projectThreads = useMemo(
    () => threads.filter((thread) => thread.worktree.repoId === repoId),
    [threads, repoId]
  )

  const needingAttention = useMemo(
    () =>
      projectThreads.filter(
        (thread) =>
          needsAgentCanvasAttention(thread) && project.tabs.some((x) => thread.paneKey in x.cards)
      ),
    [projectThreads, project.tabs]
  )
  const nextAttention = useCallback(() => {
    const next =
      needingAttention[
        (needingAttention.findIndex((x) => x.paneKey === lastAttentionKey.current) + 1) %
          needingAttention.length
      ]
    if (!next) {
      return
    }
    const target = project.tabs.find((x) => next.paneKey in x.cards)!
    lastAttentionKey.current = next.paneKey
    setAttentionKey(next.paneKey)
    updateProject((p) => ({ ...p, activeTabId: target.id }))
    selectThread(next)
  }, [needingAttention, project.tabs, updateProject, selectThread])
  const handleAttention = useCallback(() => setAttentionKey(null), [])

  // Relatives determine placement across tabs.
  useEffect(() => {
    if (projectThreads.length === 0) {
      return
    }
    const byWorktree = new Map<string, string[]>()
    for (const thread of projectThreads) {
      byWorktree.set(thread.worktree.id, [
        ...(byWorktree.get(thread.worktree.id) ?? []),
        thread.paneKey
      ])
    }
    const requests = projectThreads.map((thread) => {
      const parentId = lineage[thread.worktree.id]?.parentWorktreeId
      return {
        paneKey: thread.paneKey,
        nearPaneKeys: [
          ...(parentId ? (byWorktree.get(parentId) ?? []) : []),
          ...(byWorktree.get(thread.worktree.id) ?? []).filter((k) => k !== thread.paneKey)
        ]
      }
    })
    updateProject((p) => placeNewAgentCanvasCards(p, p.activeTabId, requests))
  }, [projectThreads, lineage, updateProject])

  const openComposer = useCallback(() => {
    if (!repo) {
      return
    }
    const state = useAppStore.getState()
    state.openModal('new-workspace-composer', {
      initialRepoId: repo.id,
      initialWorkspaceTarget: getRepoWorkspaceCreationTargetHint(repo, state.projectHostSetups),
      telemetrySource: 'sidebar'
    })
  }, [repo])

  const forkThread = useCallback((thread: AgentPaneThread) => {
    openChildWorktreeComposer(useAppStore.getState(), thread.worktree, null, 'sidebar')
  }, [])

  if (repos.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-xs text-muted-foreground">
        {t('agentCanvas.noProjects', 'Add a project to see its agents here.')}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border px-2 pb-1.5">
        <Select
          value={repoId ?? undefined}
          onValueChange={(value) => updateAgentCanvas((l) => ({ ...l, repoId: value }))}
        >
          <SelectTrigger
            size="sm"
            className="h-7 w-auto max-w-44 shrink-0 gap-1 border-none px-2 text-xs font-semibold shadow-none"
            aria-label={t('agentCanvas.project', 'Project')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {repos.map((r) => (
              <SelectItem key={r.id} value={r.id} className="text-xs">
                {r.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {repo ? <CanvasProjectActions repo={repo} /> : null}
        {repoId ? <CanvasCoordinator repoId={repoId} /> : null}
        <CanvasTabStrip
          project={project}
          onSelect={(id) => updateProject((p) => ({ ...p, activeTabId: id }))}
          onRename={(id, name) => updateTab(id, (x) => ({ ...x, name }))}
          onClose={(id) => updateProject((p) => removeAgentCanvasTab(p, id))}
          onAdd={() =>
            updateProject((p) => {
              const id = `tab-${Date.now().toString(36)}`
              return {
                ...p,
                tabs: [
                  ...p.tabs,
                  {
                    id,
                    name: t('agentCanvas.newTabName', 'Tab {{n}}', { n: p.tabs.length + 1 }),
                    cards: {}
                  }
                ],
                activeTabId: id
              }
            })
          }
        />
      </div>
      {repoId && tab ? (
        <ReactFlowProvider key={`${repoId}:${tab.id}`}>
          <CanvasSurface
            onRestore={history.restore}
            onEditTab={(update) => editTab(tab.id, update)}
            tab={tab}
            tabs={project.tabs}
            threads={projectThreads}
            lineage={lineage}
            attentionKey={attentionKey}
            onAttentionHandled={handleAttention}
            onNextAttention={needingAttention.length ? nextAttention : undefined}
            onSelect={selectThread}
            onJump={jumpToWorkspace}
            onFork={forkThread}
            onAddAgent={repo ? openComposer : undefined}
            onMoveCards={(moved) =>
              updateTab(tab.id, (x) => ({ ...x, cards: { ...x.cards, ...moved } }))
            }
            onMoveToTab={(paneKey, tabId) =>
              history.commit((p) => moveAgentCanvasCards(p, [paneKey], tabId))
            }
            onViewport={(viewport) => updateTab(tab.id, (x) => ({ ...x, viewport }))}
          />
        </ReactFlowProvider>
      ) : null}
    </div>
  )
}
