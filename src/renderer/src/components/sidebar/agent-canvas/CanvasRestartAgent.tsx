import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { useTranslate } from '@/i18n/use-translate'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { closeTerminalTab } from '@/components/terminal/terminal-tab-actions'
import { launchAgentInNewTab } from '@/lib/agent-session/launch/new-tab/launch-agent-in-new-tab'
import { newAgentLaunchRequestId } from '@/lib/agent-session/launch/routing/agent-launch-request-id'
import type { AgentPaneThread } from '@/components/activity/activity-thread-types'
import { TUI_AGENT_CONFIG } from '../../../../../shared/agent-launch/catalog/tui-agent-config'
import type { TuiAgent } from '../../../../../shared/agent-launch/catalog/tui-agent'
import { waitForCoordinatorPane } from './CanvasCoordinator'
import { AGENT_CANVAS_CARD_WIDTH } from '../../../../../shared/agent-canvas-layout'

export function canRestartCanvasAgent(thread: AgentPaneThread): boolean {
  return Object.hasOwn(TUI_AGENT_CONFIG, thread.agentType)
}
export function CanvasRestartAgent({
  thread,
  close
}: {
  thread: AgentPaneThread
  close: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const [args, setArgs] = useState(
    () =>
      useAppStore.getState().agentLaunchConfigByPaneKey[thread.paneKey]?.launchConfig.agentArgs ??
      useAppStore.getState().sleepingAgentSessionsByPaneKey[thread.paneKey]?.launchConfig
        ?.agentArgs ??
      ''
  )
  const [closeOld, setCloseOld] = useState(false)
  const [pending, setPending] = useState(false)
  const composing = useRef(false)
  const launch = async (): Promise<void> => {
    if (pending) {
      return
    }
    setPending(true)
    try {
      const result = launchAgentInNewTab({
        requestId: newAgentLaunchRequestId(),
        agent: thread.agentType as TuiAgent,
        worktreeId: thread.worktree.id,
        requestedSurface: 'terminal',
        actionAgentArgs: args
      })
      if (!result || 'refused' in result || result.surface.kind === 'host-published') {
        throw new Error('No local surface')
      }
      const key = await waitForCoordinatorPane(
        result.surface.kind === 'local-chat' ? null : result.surface.tabId,
        result.structuredSettlement
      )
      useAppStore.getState().updateAgentCanvas((layout) => {
        const project = layout.projects[thread.worktree.repoId]
        if (!project) {
          return layout
        }
        const source = project.tabs.find((tab) => thread.paneKey in tab.cards)
        if (!source) {
          return layout
        }
        const style = project.cardStyles?.[thread.paneKey]
        return {
          ...layout,
          projects: {
            ...layout.projects,
            [thread.worktree.repoId]: {
              ...project,
              ...(style ? { cardStyles: { ...project.cardStyles, [key]: style } } : {}),
              tabs: project.tabs.map((tab) => {
                const cards = { ...tab.cards }
                delete cards[key]
                if (tab.id === source.id) {
                  const old = source.cards[thread.paneKey]
                  // Keeping the old agent: sit beside it instead of on top of it.
                  cards[key] = closeOld
                    ? old
                    : { x: old.x + AGENT_CANVAS_CARD_WIDTH + 32, y: old.y }
                }
                return { ...tab, cards }
              })
            }
          }
        }
      })
      if (closeOld) {
        if (useAppStore.getState().terminalLayoutsByTabId[thread.tab.id]) {
          closeTerminalTab(thread.tab.id, { reason: 'requested' })
        } else {
          useAppStore.getState().closeUnifiedTab(thread.tab.id)
        }
      }
      close()
    } catch {
      toast.error(
        t('agentCanvas.restartFailed', 'Could not restart the agent. Check the launched tab.')
      )
    } finally {
      setPending(false)
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) {
          close()
        }
      }}
    >
      <DialogContent
        onClick={(e) => e.stopPropagation()}
        onEscapeKeyDown={(e) => {
          if (composing.current || e.isComposing || pending) {
            e.preventDefault()
          }
        }}
        onCompositionStart={() => {
          composing.current = true
        }}
        onCompositionEnd={() => {
          composing.current = false
        }}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (
            e.key === 'Enter' &&
            !composing.current &&
            !e.nativeEvent.isComposing &&
            e.keyCode !== 229
          ) {
            e.preventDefault()
            void launch()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{t('agentCanvas.restartArgs', 'Restart with arguments…')}</DialogTitle>
        </DialogHeader>
        <Input
          disabled={pending}
          value={args}
          onChange={(e) => setArgs(e.target.value)}
          aria-label={t('agentCanvas.arguments', 'CLI arguments')}
        />
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            disabled={pending}
            checked={closeOld}
            onCheckedChange={(value) => setCloseOld(value === true)}
          />
          {t('agentCanvas.closeOld', 'Close the old agent')}
        </label>
        <Button disabled={pending} onClick={() => void launch()}>
          {t('agentCanvas.restart', 'Restart')}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
