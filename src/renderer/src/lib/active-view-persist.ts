import type { PersistedUIState } from '../../../shared/persisted-ui-state-types'
import type { TopLevelView } from '../../../shared/ui-chrome-types'
import type { AgentCanvasLayouts } from '../../../shared/agent-canvas-layout'

type ActiveViewUnloadState = {
  activeView: TopLevelView
  persistedUIReady: boolean
  agentCanvas?: AgentCanvasLayouts
  persistedUIWriteBaseline?: { agentCanvas?: AgentCanvasLayouts } | null
  persistedUIWriteInFlightCounts?: { agentCanvas?: number }
}

export function buildActiveViewUnloadPatch(
  state: ActiveViewUnloadState
): Partial<PersistedUIState> {
  // Startup unload must not replace the saved view with defaults before hydration.
  if (!state.persistedUIReady) {
    return {}
  }
  // Canvas drags made inside the writer's debounce would otherwise be lost on quit; send only when dirty so a stale copy never overwrites a peer.
  const canvas = state.agentCanvas
  // An in-flight write may land after this patch, so a flip back to the baseline must still be sent.
  const canvasDirty =
    canvas !== undefined &&
    ((state.persistedUIWriteInFlightCounts?.agentCanvas ?? 0) > 0 ||
      JSON.stringify(canvas) !== JSON.stringify(state.persistedUIWriteBaseline?.agentCanvas))
  return { activeView: state.activeView, ...(canvasDirty ? { agentCanvas: canvas } : {}) }
}
