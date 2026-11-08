import type { Repo } from '../../../../../shared/repo-types'
import type { Worktree } from '../../../../../shared/worktree/types'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../../shared/execution-host'
import { getRepoWorkspaceCreationTargetHint } from '@/lib/project-host-workspace-target'
import { resolveReviewRepository } from '@/lib/review-owner'
import { canCreateChildWorktree } from '@/components/sidebar/workspace-actions/context-menu/worktree-context-menu-policy'
import type { AppState } from '@/store/types'

export function resolveChildWorktreeRepository(
  repos: readonly Repo[],
  worktree: Worktree
): Repo | null {
  return resolveReviewRepository(repos, {
    ...worktree,
    // Unstamped clicked rows are local, regardless of the active workspace's owner.
    hostId:
      worktree.hostId ??
      (worktree.runtimeOwnerEnvironmentId?.trim() ? undefined : LOCAL_EXECUTION_HOST_ID)
  })
}

/** Opens the composer for a child of `worktree`; false when it cannot have one. */
export function openChildWorktreeComposer(
  state: Pick<AppState, 'repos' | 'projectHostSetups' | 'openModal'>,
  worktree: Worktree,
  folderWorkspaceId: string | null,
  telemetrySource: 'sidebar'
): boolean {
  const repo = resolveChildWorktreeRepository(state.repos, worktree)
  if (!repo || !canCreateChildWorktree({ repo, folderWorkspaceId, worktree })) {
    return false
  }
  state.openModal('new-workspace-composer', {
    initialRepoId: repo.id,
    initialWorkspaceTarget: getRepoWorkspaceCreationTargetHint(repo, state.projectHostSetups),
    initialParentWorktreeId: worktree.id,
    telemetrySource
  })
  return true
}
