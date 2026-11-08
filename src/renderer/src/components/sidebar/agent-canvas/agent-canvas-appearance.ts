import type { AgentPaneThread } from '@/components/activity/activity-thread-types'
import { activityThreadStatusId } from '@/components/activity/activity-thread-presentation'
import { isIdleAgentCanvasThread } from './use-idle-agent-canvas-threads'

export function needsAgentCanvasAttention(thread: AgentPaneThread): boolean {
  return (
    !isIdleAgentCanvasThread(thread) &&
    ['waiting', 'blocked', 'failed'].includes(activityThreadStatusId(thread))
  )
}

export function agentCanvasWorkspaceColor(id: string): string {
  let hash = 0
  for (const char of id) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  }
  // Only hues whose palette vars Orca's CSS already emits.
  const hues = ['sky', 'emerald', 'violet', 'rose', 'fuchsia']
  return `var(--color-${hues[hash % hues.length]}-500)`
}
