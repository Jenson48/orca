import { useMemo } from 'react'
import { useAppStore } from '@/store'
import { getStructuredAgentSessionTabsByPaneKey } from '@/components/native-chat/session/status/structured-agent-session-tabs'
import type { AgentPaneThread } from '@/components/activity/activity-thread-types'
import { canvasWorktree } from './canvas-worktree'
import { readWorktreeAgentRows } from '../workspace-card/activity/worktree-agent-rows-snapshot'
import type { TerminalTab } from '../../../../../shared/workspace-layout/terminal-tab-types'
import type { Worktree } from '../../../../../shared/worktree/types'

function idleThread(
  paneKey: string,
  worktree: Worktree,
  tab: TerminalTab,
  agentType: AgentPaneThread['agentType']
): AgentPaneThread {
  return {
    paneKey,
    paneTitle: tab.customTitle ?? tab.title,
    worktree,
    repo: null,
    tab,
    agentType,
    currentAgentState: null,
    currentAgentEntry: null,
    responsePreview: '',
    latestTimestamp: tab.createdAt ?? 0,
    latestEvent: null,
    events: [],
    unread: false
  }
}

/** Agents with no turn yet, as card-ready threads: fresh chat tabs, and terminal agents (e.g. dsh)
 *  that only reported a session start, which the activity feed deliberately skips. */
export function useIdleAgentCanvasThreads(threads: readonly AgentPaneThread[]): AgentPaneThread[] {
  const unifiedTabs = useAppStore((s) => s.unifiedTabsByWorktree)
  const getKnownWorktreeById = useAppStore((s) => s.getKnownWorktreeById)
  const statusByPane = useAppStore((s) => s.agentStatusByPaneKey)
  const terminalTabs = useAppStore((s) => s.tabsByWorktree)
  const foreground = useAppStore((s) => s.paneForegroundAgentByPaneKey)
  const paneTitles = useAppStore((s) => s.runtimePaneTitlesByTabId)
  return useMemo(() => {
    const known = new Set(threads.map((thread) => thread.paneKey))
    const idle: AgentPaneThread[] = []
    for (const [paneKey, tab] of getStructuredAgentSessionTabsByPaneKey(unifiedTabs)) {
      const worktree = known.has(paneKey)
        ? undefined
        : canvasWorktree(tab.worktreeId, getKnownWorktreeById(tab.worktreeId, tab.executionHostId))
      if (!worktree) {
        continue
      }
      const title = tab.customLabel ?? tab.generatedLabel ?? tab.label
      known.add(paneKey)
      idle.push(
        idleThread(
          paneKey,
          worktree,
          {
            id: tab.id,
            ptyId: null,
            worktreeId: tab.worktreeId,
            title,
            customTitle: tab.customLabel,
            color: tab.color,
            sortOrder: tab.sortOrder,
            createdAt: tab.createdAt
          },
          tab.agentSessionAgent ?? 'unknown'
        )
      )
    }
    for (const entry of Object.values(statusByPane)) {
      if (known.has(entry.paneKey) || entry.sessionBoundary !== true || !entry.worktreeId) {
        continue
      }
      const tab = terminalTabs[entry.worktreeId]?.find((t) => t.id === entry.tabId)
      const worktree = tab
        ? canvasWorktree(entry.worktreeId, getKnownWorktreeById(entry.worktreeId))
        : undefined
      if (tab && worktree) {
        known.add(entry.paneKey)
        idle.push(idleThread(entry.paneKey, worktree, tab, entry.agentType ?? 'unknown'))
      }
    }
    // Every other agent a workspace card lists (title- or process-detected, retained), so the canvas matches the sidebar.
    // Rows read the store snapshot; these subscriptions only trigger the recompute.
    void foreground
    void paneTitles
    const state = useAppStore.getState()
    for (const worktreeId of Object.keys(terminalTabs)) {
      const worktree = canvasWorktree(worktreeId, getKnownWorktreeById(worktreeId))
      if (!worktree) {
        continue
      }
      for (const row of readWorktreeAgentRows(state, worktreeId)) {
        if (row.rowSource === 'subagent' || known.has(row.paneKey)) {
          continue
        }
        known.add(row.paneKey)
        idle.push(idleThread(row.paneKey, worktree, row.tab, row.agentType))
      }
      // Agent tabs restored after a restart stay unspawned until opened; keep their card.
      for (const tab of terminalTabs[worktreeId] ?? []) {
        const leaf = tab.launchAgent ? state.terminalLayoutsByTabId[tab.id]?.activeLeafId : null
        const paneKey = leaf ? `${tab.id}:${leaf}` : null
        if (!paneKey || [...known].some((key) => key.startsWith(`${tab.id}:`))) {
          continue
        }
        known.add(paneKey)
        idle.push(idleThread(paneKey, worktree, tab, tab.launchAgent!))
      }
    }
    return idle
  }, [
    threads,
    unifiedTabs,
    statusByPane,
    terminalTabs,
    foreground,
    paneTitles,
    getKnownWorktreeById
  ])
}

/** A card with no status history has not started yet. */
export function isIdleAgentCanvasThread(thread: AgentPaneThread): boolean {
  return !thread.latestEvent && !thread.currentAgentState && !thread.paneEntry
}
