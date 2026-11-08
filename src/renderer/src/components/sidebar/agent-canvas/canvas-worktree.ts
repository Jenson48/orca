import type { AgentPaneThread } from '@/components/activity/activity-thread-types'
import type { DetectedWorktree, Worktree } from '../../../../../shared/worktree/types'

const synthetic = new Map<string, Worktree>()

/** Folder-project roots ("<repoId>::<path>") are not catalog worktrees; derive their project from the id. */
export function canvasWorktree(
  worktreeId: string,
  known: Worktree | DetectedWorktree | undefined
): Worktree | undefined {
  if (known && !known.repoId.startsWith('__')) {
    return known as Worktree
  }
  const split = worktreeId.indexOf('::')
  if (split <= 0) {
    return undefined
  }
  let worktree = synthetic.get(worktreeId)
  if (!worktree) {
    const path = worktreeId.slice(split + 2)
    worktree = {
      ...(known as Worktree | undefined),
      id: worktreeId,
      repoId: worktreeId.slice(0, split),
      path,
      head: '',
      branch: '',
      isBare: false,
      isMainWorktree: !path.includes('::workspace:'),
      displayName: path.split('/').pop() ?? path,
      comment: '',
      linkedIssue: null,
      linkedPR: null,
      linkedLinearIssue: null,
      isArchived: false,
      isUnread: false,
      isPinned: false,
      sortOrder: 0,
      lastActivityAt: 0
    }
    synthetic.set(worktreeId, worktree)
  }
  return worktree
}

/** Re-home Activity threads that fell back to the synthetic "standalone" owner. */
export function withCanvasWorktree(thread: AgentPaneThread): AgentPaneThread {
  if (!thread.worktree.repoId.startsWith('__')) {
    return thread
  }
  const worktree = canvasWorktree(thread.worktree.id, undefined)
  return worktree ? { ...thread, worktree } : thread
}
