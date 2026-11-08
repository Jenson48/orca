import { getStructuredAgentSessionTabsByPaneKey } from '@/components/native-chat/session/status/structured-agent-session-tabs'
import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import type { AppState } from '@/store/types'
import { migrationUnsupportedToAgentStatusEntry } from '../../../../../../shared/migration-unsupported-agent-entry'
import { buildWorktreeAgentRows } from './worktree-agent-rows'
import {
  selectLiveAgentStatusEntriesForWorktree,
  selectMigrationUnsupportedEntriesForWorktree,
  selectRetainedAgentEntriesForWorktree,
  selectTerminalLayoutsForWorktree
} from './worktree-agent-row-selectors'
import {
  selectLivePtyIdsForWorktree,
  selectPaneForegroundAgentsForWorktree,
  selectRuntimePaneTitlesForWorktree
} from './worktree-card-status-inputs'
import { selectWorktreeAgentOrchestration } from './worktree-agent-orchestration-index'

/** The same agent rows a workspace card lists, read once from a store snapshot (no subscription). */
export function readWorktreeAgentRows(
  state: AppState,
  worktreeId: string,
  now = Date.now()
): DashboardAgentRow[] {
  const live = selectLiveAgentStatusEntriesForWorktree(state, worktreeId)
  const unsupported = selectMigrationUnsupportedEntriesForWorktree(state, worktreeId)
  const entries =
    unsupported.length > 0
      ? [
          ...live,
          ...unsupported.flatMap((item) => {
            const entry = migrationUnsupportedToAgentStatusEntry(item)
            return entry ? [entry] : []
          })
        ]
      : live
  return buildWorktreeAgentRows({
    tabs: state.tabsByWorktree[worktreeId] ?? [],
    representedTabs: getStructuredAgentSessionTabsByPaneKey(state.unifiedTabsByWorktree),
    entries,
    retained: selectRetainedAgentEntriesForWorktree(state, worktreeId),
    runtimePaneTitlesByTabId: selectRuntimePaneTitlesForWorktree(state, worktreeId),
    ptyIdsByTabId: selectLivePtyIdsForWorktree(state, worktreeId),
    terminalLayoutsByTabId: selectTerminalLayoutsForWorktree(state, worktreeId),
    runtimeAgentOrchestrationByPaneKey: selectWorktreeAgentOrchestration(state, worktreeId),
    paneForegroundAgentByPaneKey: selectPaneForegroundAgentsForWorktree(state, worktreeId),
    now
  })
}
