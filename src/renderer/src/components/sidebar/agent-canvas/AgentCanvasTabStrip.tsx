import React, { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/utils'
import {
  AGENT_CANVAS_MAIN_TAB_ID,
  type AgentCanvasProjectLayout
} from '../../../../../shared/agent-canvas-layout'

export function CanvasTabStrip({
  project,
  onSelect,
  onRename,
  onClose,
  onAdd
}: {
  project: AgentCanvasProjectLayout
  onSelect: (id: string) => void
  onRename: (id: string, name: string) => void
  onClose: (id: string) => void
  onAdd: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const [editing, setEditing] = useState<string | null>(null)
  return (
    <div className="flex min-w-0 items-center gap-0.5" role="tablist">
      {project.tabs.map((tab) => {
        const active = tab.id === project.activeTabId
        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={active}
            tabIndex={0}
            onClick={() => onSelect(tab.id)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(tab.id)}
            onDoubleClick={() => setEditing(tab.id)}
            title={t('agentCanvas.renameHint', 'Double-click to rename')}
            className={cn(
              'group/tab flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-md px-2 text-xs select-none',
              active
                ? 'bg-foreground/10 font-semibold text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {editing === tab.id ? (
              <Input
                autoFocus
                defaultValue={tab.name}
                className="h-5 w-24 rounded-sm px-1 py-0 text-xs md:text-xs"
                onFocus={(e) => e.currentTarget.select()}
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => {
                  const name = e.currentTarget.value.trim()
                  if (name && name !== tab.name) {
                    onRename(tab.id, name)
                  }
                  setEditing(null)
                }}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Enter') {
                    e.currentTarget.blur()
                  } else if (e.key === 'Escape') {
                    setEditing(null)
                  }
                }}
              />
            ) : (
              <span className="max-w-28 truncate">{tab.name}</span>
            )}
            {tab.id !== AGENT_CANVAS_MAIN_TAB_ID ? (
              <button
                type="button"
                aria-label={t('agentCanvas.closeTab', 'Close {{name}}', { name: tab.name })}
                title={t('agentCanvas.closeTabHint', 'Close tab; its cards move to Main')}
                className="rounded-sm text-muted-foreground opacity-0 group-hover/tab:opacity-100 hover:text-foreground focus-visible:opacity-100"
                onClick={(e) => {
                  e.stopPropagation()
                  onClose(tab.id)
                }}
              >
                <X className="size-3" />
              </button>
            ) : null}
          </div>
        )
      })}
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="shrink-0 text-muted-foreground"
        aria-label={t('agentCanvas.newTab', 'New tab')}
        onClick={onAdd}
      >
        <Plus className="size-3.5" />
      </Button>
    </div>
  )
}
