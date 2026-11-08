import { useMemo } from 'react'
import { useAppStore } from '@/store'
import { getStructuredAgentSessionTabsByPaneKey } from '@/components/native-chat/session/status/structured-agent-session-tabs'
import type { AgentPaneThread } from '@/components/activity/activity-thread-types'
import type { Worktree } from '../../../../../shared/worktree/types'

/** Chat tabs whose agent has not reported any status yet (a fresh chat), as card-ready threads. */
export function useIdleAgentCanvasThreads(threads: readonly AgentPaneThread[]): AgentPaneThread[] {
  const unifiedTabs = useAppStore((s) => s.unifiedTabsByWorktree)
  const getKnownWorktreeById = useAppStore((s) => s.getKnownWorktreeById)
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
      idle.push({
        paneKey,
        paneTitle: title,
        worktree,
        repo: null,
        tab: {
          id: tab.id,
          ptyId: null,
          worktreeId: tab.worktreeId,
          title,
          customTitle: tab.customLabel,
          color: tab.color,
          sortOrder: tab.sortOrder,
          createdAt: tab.createdAt
        },
        agentType: tab.agentSessionAgent ?? 'unknown',
        currentAgentState: null,
        currentAgentEntry: null,
        responsePreview: '',
        latestTimestamp: tab.createdAt,
        latestEvent: null,
        events: [],
        unread: false
      })
    }
    return idle
  }, [threads, unifiedTabs, getKnownWorktreeById])
}

/** A card with no status history has not started yet. */
export function isIdleAgentCanvasThread(thread: AgentPaneThread): boolean {
  return !thread.latestEvent && !thread.currentAgentState && !thread.paneEntry
}
