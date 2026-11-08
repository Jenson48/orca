import type { UISlice, UISliceGet, UISliceSet } from './ui-slice-contract'

/** Agent canvas layout; the shared persisted-UI writer diffs and saves it with the other UI fields. */
export function createAgentCanvasActions(set: UISliceSet, get: UISliceGet): Partial<UISlice> {
  return {
    agentCanvas: { repoId: null, projects: {} },
    updateAgentCanvas: (update) => {
      const next = update(get().agentCanvas)
      if (next !== get().agentCanvas) {
        set({ agentCanvas: next })
      }
    }
  }
}
