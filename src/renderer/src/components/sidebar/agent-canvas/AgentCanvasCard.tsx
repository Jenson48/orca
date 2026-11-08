import React from 'react'
import { Handle, Position, useStore, type Node, type NodeProps } from '@xyflow/react'
import { GitBranchPlus, MoreHorizontal, SquareArrowOutUpRight } from 'lucide-react'
import { AgentTypeIcon } from '@/lib/agent-type-icon'
import { AgentStateDot, agentStateLabel } from '@/components/AgentStateDot'
import { ThreadAgentStateIndicator } from '@/components/activity/activity-thread-controls'
import {
  activityThreadRowCopy,
  activityThreadStatusId
} from '@/components/activity/activity-thread-presentation'
import type { AgentPaneThread } from '@/components/activity/activity-thread-types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/utils'
import { formatAgentTypeLabel } from '../../../../../shared/agent-status/presentation/agent-type-label'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../../shared/execution-host'
import {
  AGENT_CANVAS_CARD_HEIGHT,
  AGENT_CANVAS_CARD_WIDTH
} from '../../../../../shared/agent-canvas-layout'
import { isIdleAgentCanvasThread } from './use-idle-agent-canvas-threads'
import { needsAgentCanvasAttention, agentCanvasWorkspaceColor } from './agent-canvas-appearance'

export type AgentCanvasCardData = {
  thread: AgentPaneThread
  hostId: string
  canFork: boolean
  otherTabs: { id: string; name: string }[]
  onFork: (thread: AgentPaneThread) => void
  onJump: (thread: AgentPaneThread) => void
  onMoveToTab: (paneKey: string, tabId: string) => void
}

export type AgentCanvasNode = Node<AgentCanvasCardData, 'agent'>

export const AgentCanvasCard = React.memo(function AgentCanvasCard({
  data,
  selected
}: NodeProps<AgentCanvasNode>): React.JSX.Element {
  const compact = useStore((s) => s.transform[2] < 0.6)
  const t = useTranslate()
  const { thread } = data
  const { taskTitle, statusLine, workspaceLabel } = activityThreadRowCopy(thread, t)
  const idle = isIdleAgentCanvasThread(thread)
  const state = idle ? 'idle' : activityThreadStatusId(thread)

  return (
    <div
      style={{
        width: AGENT_CANVAS_CARD_WIDTH,
        minHeight: compact ? 44 : AGENT_CANVAS_CARD_HEIGHT,
        borderLeftWidth: 4,
        borderLeftColor: agentCanvasWorkspaceColor(thread.worktree.id)
      }}
      className={cn(
        'group flex flex-col gap-1.5 rounded-lg border bg-card px-3 py-2.5 text-card-foreground shadow-xs transition-[border-color,box-shadow]',
        selected ? 'border-primary ring-1 ring-primary' : 'border-border',
        needsAgentCanvasAttention(thread) && 'border-status-warning ring-2 ring-status-warning',
        !thread.currentAgentState && 'opacity-90'
      )}
      aria-label={taskTitle}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} className="!opacity-0" />
      <div className="flex min-w-0 items-start gap-1.5">
        <span className="mt-0.5 inline-flex shrink-0">
          {idle ? (
            <AgentStateDot state="idle" size="md" title={agentStateLabel('idle')} />
          ) : (
            <ThreadAgentStateIndicator thread={thread} />
          )}
        </span>
        <div className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-5">
          {taskTitle}
        </div>
        {!compact && thread.unread ? (
          <span
            className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
            aria-label={t('agentCanvas.unread', 'Unread')}
          />
        ) : null}
        {!compact && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="nodrag -mr-1 -mt-0.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                aria-label={t('agentCanvas.cardActions', 'Card actions')}
                onClick={(event) => event.stopPropagation()}
              >
                <MoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
              <DropdownMenuItem disabled={!data.canFork} onSelect={() => data.onFork(thread)}>
                <GitBranchPlus className="size-3.5" />
                {t('agentCanvas.fork', 'Fork into a child workspace…')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => data.onJump(thread)}>
                <SquareArrowOutUpRight className="size-3.5" />
                {t('agentCanvas.jumpToWorkspace', 'Go to workspace')}
              </DropdownMenuItem>
              {data.otherTabs.length > 0 ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      {t('agentCanvas.moveToTab', 'Move to tab')}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {data.otherTabs.map((tab) => (
                        <DropdownMenuItem
                          key={tab.id}
                          onSelect={() => data.onMoveToTab(thread.paneKey, tab.id)}
                        >
                          {tab.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {!compact && (
        <>
          <div className="truncate font-mono text-[11px] text-muted-foreground">
            {workspaceLabel}
          </div>
          {statusLine ? (
            <div className="line-clamp-2 text-[11.5px] leading-4 text-muted-foreground">
              {statusLine}
            </div>
          ) : null}
          <div className="mt-auto flex items-center gap-1.5 pt-1">
            <span className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-px font-mono text-[10px] uppercase">
              <AgentTypeIcon agentType={thread.agentType} size={11} />
              {formatAgentTypeLabel(thread.agentType)}
            </span>
            <span className="rounded-md border border-border px-1.5 py-px font-mono text-[10px] uppercase text-muted-foreground">
              {data.hostId === LOCAL_EXECUTION_HOST_ID
                ? t('agentCanvas.local', 'Local')
                : data.hostId}
            </span>
            <span className="ml-auto truncate font-mono text-[10px] uppercase text-muted-foreground">
              {agentStateLabel(state)}
            </span>
          </div>
        </>
      )}
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={false}
        className="!opacity-0"
      />
    </div>
  )
})
