import { useMemo } from 'react'
import { useAppStore } from '@/store'
import { getStructuredAgentSessionTabsByPaneKey } from '@/components/native-chat/session/status/structured-agent-session-tabs'
import type { AgentPaneThread } from '@/components/activity/activity-thread-types'
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
  return useMemo(() => {
    const known = new Set(threads.map((thread) => thread.paneKey))
    const idle: AgentPaneThread[] = []
    for (const [paneKey, tab] of getStructuredAgentSessionTabsByPaneKey(unifiedTabs)) {
      const worktree = known.has(paneKey)
        ? undefined
        : (getKnownWorktreeById(tab.worktreeId, tab.executionHostId) as Worktree | undefined)
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
        ? (getKnownWorktreeById(entry.worktreeId) as Worktree | undefined)
        : undefined
      if (tab && worktree) {
        known.add(entry.paneKey)
        idle.push(idleThread(entry.paneKey, worktree, tab, entry.agentType ?? 'unknown'))
      }
    }
    return idle
  }, [threads, unifiedTabs, statusByPane, terminalTabs, getKnownWorktreeById])
}

/** A card with no status history has not started yet. */
export function isIdleAgentCanvasThread(thread: AgentPaneThread): boolean {
  return !thread.latestEvent && !thread.currentAgentState && !thread.paneEntry
}
