import { useEffect } from 'react'
import { useAppStore } from '@/store'
import { sendMessageToAgent } from '@/lib/agent-message-send'
import { getStructuredAgentSessionTabsByPaneKey } from '@/components/native-chat/session/status/structured-agent-session-tabs'
import { parsePaneKey } from '../../../../../shared/workspace-layout/stable-pane-id'
import {
  CoordinatorEvents,
  formatCoordinatorEvents,
  type CoordinatorEvent
} from './coordinator-events'

export function useCoordinatorEvents(): void {
  useEffect(() => {
    const feed = new CoordinatorEvents()
    const sending = new Set<string>()
    const done = new Map<string, number>()
    let disposed = false
    let lastStatus: unknown = null
    let lastProjects: unknown = null
    const observe = (): void => {
      const state = useAppStore.getState()
      if (
        state.agentStatusByPaneKey === lastStatus &&
        state.agentCanvas.projects === lastProjects
      ) {
        return
      }
      lastStatus = state.agentStatusByPaneKey
      lastProjects = state.agentCanvas.projects
      const coordinators: Record<string, string> = {}
      for (const [repoId, project] of Object.entries(state.agentCanvas.projects)) {
        if (project.coordinatorPaneKey) {
          coordinators[repoId] = project.coordinatorPaneKey
        }
      }
      if (Object.keys(coordinators).length === 0) {
        feed.observe([], coordinators, Date.now())
        return
      }
      const worktrees = new Map(state.allWorktrees().map((w) => [w.id, w]))
      const chats = getStructuredAgentSessionTabsByPaneKey(state.unifiedTabsByWorktree)
      const events: CoordinatorEvent[] = []
      for (const [paneKey, entry] of Object.entries(state.agentStatusByPaneKey)) {
        const tabId = entry.tabId ?? parsePaneKey(paneKey)?.tabId
        const worktreeId =
          entry.worktreeId ??
          chats.get(paneKey)?.worktreeId ??
          Object.entries(state.tabsByWorktree).find(([, tabs]) =>
            tabs.some((tab) => tab.id === tabId)
          )?.[0]
        const worktree = worktreeId ? worktrees.get(worktreeId) : undefined
        if (!worktree) {
          continue
        }
        events.push({
          paneKey,
          repoId: worktree.repoId,
          state: entry.state,
          stateStartedAt: entry.stateStartedAt,
          title: entry.terminalTitle ?? paneKey,
          agentType: entry.agentType ?? 'unknown',
          workspace: worktree.displayName,
          path: worktree.path,
          message: entry.interactivePrompt ?? entry.lastAssistantMessage ?? entry.prompt,
          sessionBoundary: entry.sessionBoundary,
          restored: entry.restoredUnconfirmed,
          hidden: entry.subagentObservation !== undefined
        })
      }
      feed.observe(events, coordinators, Date.now())
      for (const [repoId, pane] of Object.entries(coordinators)) {
        const entry = state.agentStatusByPaneKey[pane]
        if (entry?.state === 'done' && done.get(pane) !== entry.stateStartedAt) {
          done.set(pane, entry.stateStartedAt)
          feed.coordinatorDone(repoId, Date.now())
        }
      }
    }
    const flush = async (): Promise<void> => {
      for (const repoId of feed.ready(Date.now())) {
        if (disposed || sending.has(repoId)) {
          continue
        }
        const state = useAppStore.getState()
        const pane = state.agentCanvas.projects[repoId]?.coordinatorPaneKey
        if (!pane) {
          feed.take(repoId)
          continue
        }
        const chat = getStructuredAgentSessionTabsByPaneKey(state.unifiedTabsByWorktree).get(pane)
        const terminal = parsePaneKey(pane)
        const worktreeId =
          chat?.worktreeId ??
          Object.entries(state.tabsByWorktree).find(([, tabs]) =>
            tabs.some((tab) => tab.id === terminal?.tabId)
          )?.[0]
        if (!worktreeId || (!chat && !terminal)) {
          continue
        }
        const events = feed.take(repoId)
        sending.add(repoId)
        try {
          const result = await sendMessageToAgent({
            worktreeId,
            target: chat
              ? { kind: 'structured-session', sessionId: chat.entityId }
              : { kind: 'terminal', tabId: terminal!.tabId, leafId: terminal!.leafId },
            prompt: formatCoordinatorEvents(events)
          })
          if (result.status !== 'sent') {
            feed.retry(repoId, events)
          }
        } catch {
          feed.retry(repoId, events)
        } finally {
          sending.delete(repoId)
        }
      }
    }
    observe()
    const unsubscribe = useAppStore.subscribe(observe)
    const timer = setInterval(() => {
      void flush()
    }, 1000)
    return () => {
      disposed = true
      unsubscribe()
      clearInterval(timer)
    }
  }, [])
}
