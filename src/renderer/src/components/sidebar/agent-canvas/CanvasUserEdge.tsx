import { useRef, useState } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type Edge,
  type EdgeProps
} from '@xyflow/react'
import { Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useTranslate } from '@/i18n/use-translate'
export type CanvasUserEdgeData = {
  text: string
  commit: (text: string) => void
  remove: () => void
}
export function CanvasUserEdge(props: EdgeProps<Edge<CanvasUserEdgeData>>): React.JSX.Element {
  const [path, x, y] = getBezierPath(props)
  const t = useTranslate()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const settled = useRef(false)
  const finish = (cancel = false): void => {
    if (settled.current) {
      return
    }
    settled.current = true
    setEditing(false)
    if (!cancel && draft !== props.data?.text) {
      props.data?.commit(draft)
    }
  }
  return (
    <>
      <BaseEdge id={props.id} path={path} markerEnd={props.markerEnd} style={props.style} />
      {(props.selected || props.data?.text || editing) && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-auto absolute flex items-center rounded-md border border-border bg-card p-1 text-xs text-foreground"
            style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` }}
            onDoubleClick={() => {
              settled.current = false
              setDraft(props.data?.text ?? '')
              setEditing(true)
            }}
          >
            {editing ? (
              <Input
                autoFocus
                aria-label={t('agentCanvas.edgeLabel', 'Arrow label')}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={() => finish()}
                onKeyDown={(event) => {
                  event.stopPropagation()
                  if (event.nativeEvent.isComposing || event.keyCode === 229) {
                    return
                  }
                  if (event.key === 'Enter' || event.key === 'Escape') {
                    event.preventDefault()
                    finish(event.key === 'Escape')
                  }
                }}
              />
            ) : (
              <span>{props.data?.text || t('agentCanvas.addLabel', 'Add label')}</span>
            )}
            {props.selected && !editing && (
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label={t('agentCanvas.deleteEdge', 'Delete arrow')}
                onClick={(event) => {
                  event.stopPropagation()
                  props.data?.remove()
                }}
              >
                <Trash2 className="size-3" />
              </Button>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
