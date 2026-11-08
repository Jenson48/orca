import { useRef, useState } from 'react'
import { NodeResizer, NodeToolbar, type Node, type NodeProps } from '@xyflow/react'
import { Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useTranslate } from '@/i18n/use-translate'
import type { AgentCanvasItem } from '../../../../../shared/agent-canvas-layout'
import { agentCanvasHues } from './agent-canvas-appearance'

export type CanvasItemData = {
  item: AgentCanvasItem
  editing: boolean
  update: (patch: Partial<AgentCanvasItem>) => void
  remove: () => void
  finish: () => void
}
export type CanvasItem = Node<CanvasItemData, 'text' | 'frame'>

export function CanvasItemNode({ data, selected }: NodeProps<CanvasItem>): React.JSX.Element {
  const t = useTranslate()
  const { item } = data
  const [editing, setEditing] = useState(data.editing)
  const [draft, setDraft] = useState(item.text)
  const settled = useRef(false)
  const frame = item.type === 'frame'
  const body = !frame && item.style === 'body'
  const color = agentCanvasHues.includes(item.color ?? '') ? item.color : 'sky'
  const finish = (cancel = false): void => {
    if (settled.current) {
      return
    }
    settled.current = true
    setEditing(false)
    data.finish()
    if (!cancel) {
      if (!frame && !draft.trim()) {
        data.remove()
      } else if (draft !== item.text) {
        data.update({ text: draft })
      }
    }
  }
  const editorProps = {
    autoFocus: true,
    value: draft,
    'aria-label': t(frame ? 'agentCanvas.area' : 'agentCanvas.text', frame ? 'Area' : 'Text'),
    className: 'nodrag nopan bg-card text-foreground',
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft(event.target.value),
    onBlur: () => finish(),
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      event.stopPropagation()
      if (event.nativeEvent.isComposing || event.keyCode === 229) {
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        finish(true)
      } else if (event.key === 'Enter' && (!body || event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        finish()
      }
    }
  }
  return (
    <div
      className={`h-full min-h-10 rounded-md text-foreground ${selected ? 'ring-1 ring-primary' : ''}`}
      style={
        frame
          ? {
              background: `color-mix(in srgb, var(--color-${color}-500) 15%, transparent)`,
              border: `1px solid var(--color-${color}-500)`
            }
          : undefined
      }
    >
      {frame && (
        <NodeResizer
          isVisible={selected}
          minWidth={160}
          minHeight={100}
          onResizeEnd={(_, size) =>
            data.update({ x: size.x, y: size.y, width: size.width, height: size.height })
          }
        />
      )}
      <NodeToolbar isVisible={selected && !editing}>
        <div className="flex gap-1 rounded-md border border-border bg-card p-1">
          {frame
            ? agentCanvasHues.map((hue) => (
                <Button
                  key={hue}
                  size="icon-xs"
                  variant="ghost"
                  aria-label={t(`agentCanvas.${hue}`, hue)}
                  onClick={() => data.update({ color: hue })}
                >
                  <span
                    className="size-3 rounded-full"
                    style={{ background: `var(--color-${hue}-500)` }}
                  />
                </Button>
              ))
            : (['heading', 'body'] as const).map((style) => (
                <Button
                  key={style}
                  size="xs"
                  variant={item.style === style ? 'secondary' : 'ghost'}
                  onClick={() => data.update({ style })}
                >
                  {t(`agentCanvas.${style}`, style)}
                </Button>
              ))}
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={t('agentCanvas.deleteItem', 'Delete item')}
            onClick={data.remove}
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
      </NodeToolbar>
      <div
        className={
          frame
            ? 'border-b border-border px-3 py-2 text-sm font-semibold'
            : body
              ? 'whitespace-pre-wrap p-2 text-sm'
              : 'p-2 text-xl font-semibold'
        }
        onDoubleClick={() => {
          settled.current = false
          setDraft(item.text)
          setEditing(true)
        }}
      >
        {editing ? body ? <Textarea {...editorProps} /> : <Input {...editorProps} /> : item.text}
      </div>
    </div>
  )
}
