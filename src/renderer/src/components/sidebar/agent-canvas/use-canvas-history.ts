import { useRef } from 'react'
import { isEditableTarget } from '@/lib/editable-target'
import type { AgentCanvasProjectLayout } from '../../../../../shared/agent-canvas-layout'
type Update = (project: AgentCanvasProjectLayout) => AgentCanvasProjectLayout | null
export function useCanvasHistory(repoId: string | null, update: (update: Update) => void) {
  const histories = useRef(
    new Map<string, { past: AgentCanvasProjectLayout[]; future: AgentCanvasProjectLayout[] }>()
  )
  const history = (): { past: AgentCanvasProjectLayout[]; future: AgentCanvasProjectLayout[] } => {
    const key = repoId ?? ''
    if (!histories.current.has(key)) {
      histories.current.set(key, { past: [], future: [] })
    }
    return histories.current.get(key)!
  }
  return {
    commit: (action: Update) =>
      update((current) => {
        const next = action(current)
        if (!next || JSON.stringify(next) === JSON.stringify(current)) {
          return null
        }
        const h = history()
        h.past = [...h.past, current].slice(-50)
        h.future = []
        return next
      }),
    restore: (redo: boolean) =>
      update((current) => {
        const h = history()
        const source = redo ? h.future : h.past
        const previous = source.pop()
        if (!previous) {
          return null
        }
        const destination = redo ? h.past : h.future
        destination.push(current)
        if (destination.length > 50) {
          destination.shift()
        }
        return previous
      })
  }
}
export function canvasKeyboard(
  event: React.KeyboardEvent,
  remove: () => void,
  restore?: (redo: boolean) => void
): boolean {
  if (isEditableTarget(event.target) || event.nativeEvent.isComposing || event.keyCode === 229) {
    return false
  }
  const command = navigator.userAgent.includes('Mac') ? event.metaKey : event.ctrlKey
  if (command && event.code === 'KeyZ' && !event.altKey) {
    event.preventDefault()
    event.stopPropagation()
    restore?.(event.shiftKey)
    return true
  }
  if ((event.key === 'Delete' || event.key === 'Backspace') && !command && !event.altKey) {
    event.preventDefault()
    event.stopPropagation()
    remove()
    return true
  }
  return false
}
