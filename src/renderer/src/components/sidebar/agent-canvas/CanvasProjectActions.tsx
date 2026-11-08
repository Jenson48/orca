import React, { useMemo, useState } from 'react'
import { useAppStore } from '@/store'
import { useRepoMap } from '@/store/repos/use-repository-catalog'
import { getRepoOwnerWorktreeVisibilityDefaults } from '@/store/slices/worktrees/listing/worktree-visibility-defaults-by-host'
import {
  RepoHeaderProjectActionsMenu,
  type RepoHeaderProjectActions
} from '../worktree-list/rows/repo-header-project-actions'
import { SidebarWorktreeListDialogs } from '../worktree-list/rows/ProjectGroupDialogs'
import { useProjectGroupDialogs } from '../worktree-list/rows/use-project-group-dialogs'
import { openHeaderCreateComposer } from '../worktree-list/rows/header-create-workspace-target'
import { EMPTY_PROJECT_GROUPS } from '../worktree-list/viewport/viewport-props'
import { getRepoExecutionHostId } from '../../../../../shared/execution-host'
import type { Repo } from '../../../../../shared/repo-types'

const NO_INBOX_ACTIONS = new Map()

/** The sidebar's project "…" menu (settings, visibility, groups, remove), reused in the canvas header. */
export function CanvasProjectActions({ repo }: { repo: Repo }): React.JSX.Element {
  const repos = useAppStore((s) => s.repos)
  const repoMap = useRepoMap()
  const projectGroups = useAppStore((s) => s.projectGroups ?? EMPTY_PROJECT_GROUPS)
  const settings = useAppStore((s) => s.settings)
  const visibilityByHost = useAppStore((s) => s.worktreeVisibilityDefaultsByHost)
  const openModal = useAppStore((s) => s.openModal)
  const openSettingsPage = useAppStore((s) => s.openSettingsPage)
  const openSettingsTarget = useAppStore((s) => s.openSettingsTarget)
  const dialogs = useProjectGroupDialogs({ repos, repoMap, projectGroups })
  const [suppressRepoId, setSuppressRepoId] = useState<string | null>(null)
  const openVisibility = (target: Repo): void =>
    openModal('worktree-visibility', { repoId: target.id, hostId: getRepoExecutionHostId(target) })

  const actions = useMemo<RepoHeaderProjectActions>(
    () => ({
      getWorktreeVisibilityDefaults: (target) =>
        getRepoOwnerWorktreeVisibilityDefaults(target, settings, visibilityByHost),
      onOpenRepoSettings: (projectId, sectionId) => {
        openSettingsTarget({ pane: 'repo', repoId: projectId, ...(sectionId ? { sectionId } : {}) })
        openSettingsPage()
      },
      onOpenWorktreeVisibility: (target) =>
        openModal('worktree-visibility', {
          repoId: target.id,
          hostId: getRepoExecutionHostId(target)
        }),
      onCreateGroupFromRepo: dialogs.handleCreateGroupFromRepo,
      onMoveProjectToGroup: dialogs.handleMoveProjectToGroup,
      onRemoveProjectFromGroup: dialogs.handleRemoveProjectFromGroup,
      onRemoveProject: (target) =>
        openModal('confirm-remove-folder', {
          repoId: target.id,
          displayName: target.displayName,
          hostId: getRepoExecutionHostId(target)
        }),
      onCreateForRepo: openHeaderCreateComposer
    }),
    [settings, visibilityByHost, openModal, openSettingsPage, openSettingsTarget, dialogs]
  )

  return (
    <>
      <RepoHeaderProjectActionsMenu
        repo={repo}
        label={repo.displayName}
        projectGroups={projectGroups}
        actions={actions}
      />
      <SidebarWorktreeListDialogs
        dialogs={dialogs}
        repos={repos}
        settings={settings}
        suppressExternalWorktreeInboxRepoId={suppressRepoId}
        setSuppressExternalWorktreeInboxRepoId={setSuppressRepoId}
        newExternalWorktreeInboxActionState={NO_INBOX_ACTIONS}
        onConfirmSuppressExternalWorktreeInbox={() => setSuppressRepoId(null)}
        onOpenWorktreeVisibility={openVisibility}
      />
    </>
  )
}
