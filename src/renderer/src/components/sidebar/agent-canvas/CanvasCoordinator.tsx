import { useState } from 'react'
import { Crown } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { useTranslate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AgentLaunchPicker } from '@/components/agent/AgentLaunchPicker'
import { useNewTabAgentMenuRows } from '@/components/tab-bar/use-new-tab-agent-menu-rows'
import { useAgentDetectionTargetForWorktree } from '@/hooks/useAgentDetectionTarget'
import { launchAgentInNewTab } from '@/lib/agent-session/launch/new-tab/launch-agent-in-new-tab'
import { newAgentLaunchRequestId } from '@/lib/agent-session/launch/routing/agent-launch-request-id'
import { getStructuredAgentSessionTabsByPaneKey } from '@/components/native-chat/session/status/structured-agent-session-tabs'
import { emptyAgentCanvasProject } from '../../../../../shared/agent-canvas-layout'
import { coordinatorPrompt } from './coordinator-prompt'
import type { StructuredAgentLaunchSettlement } from '@/lib/agent-session/launch/continuation/structured-agent-launch-settlement'

export function CanvasCoordinator({ repoId }: { repoId: string }): React.JSX.Element {
  const t = useTranslate()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const worktree = useAppStore((s) => s.worktreesByRepo[repoId]?.find((w) => w.isMainWorktree))
  const repo = useAppStore((s) => s.repos.find((r) => r.id === repoId))
  const coordinator = useAppStore((s) => s.agentCanvas.projects[repoId]?.coordinatorPaneKey)
  const detection = useAgentDetectionTargetForWorktree(worktree?.id ?? null)
  const model = useNewTabAgentMenuRows(worktree?.id ?? '', open, detection)
  const label = coordinator
    ? t('agentCanvas.removeCoordinator', 'Remove coordinator')
    : t('agentCanvas.createCoordinator', 'Create coordinator')
  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        title={label}
        aria-label={label}
        disabled={pending || !worktree}
        onClick={() => {
          if (coordinator) {
            useAppStore.getState().updateAgentCanvas((layout) => {
              const project = { ...layout.projects[repoId] }
              delete project.coordinatorPaneKey
              return { ...layout, projects: { ...layout.projects, [repoId]: project } }
            })
          } else {
            setOpen(true)
          }
        }}
      >
        <Crown className="size-4" />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('agentCanvas.createCoordinator', 'Create coordinator')}</DialogTitle>
          </DialogHeader>
          <AgentLaunchPicker
            model={model}
            agent={null}
            worktreeId={worktree?.id}
            disabled={pending}
            onPick={async (agent) => {
              if (!worktree || !repo || pending) {
                return
              }
              setPending(true)
              try {
                const result = launchAgentInNewTab({
                  requestId: newAgentLaunchRequestId(),
                  agent,
                  worktreeId: worktree.id,
                  prompt: coordinatorPrompt(repo.displayName, worktree.path),
                  promptDelivery: 'submit-after-ready'
                })
                if (!result || 'refused' in result || result.surface.kind === 'host-published') {
                  throw new Error('Launch did not return a tab')
                }
                const paneKey = await waitForCoordinatorPane(
                  result.surface.kind === 'local-chat' ? null : result.surface.tabId,
                  result.structuredSettlement
                )
                useAppStore.getState().updateAgentCanvas((layout) => {
                  const project = layout.projects[repoId] ?? emptyAgentCanvasProject()
                  return {
                    ...layout,
                    projects: {
                      ...layout.projects,
                      [repoId]: {
                        ...project,
                        coordinatorPaneKey: paneKey,
                        activeTabId: 'main',
                        tabs: project.tabs.map((tab) => {
                          const cards = { ...tab.cards }
                          delete cards[paneKey]
                          if (tab.id === 'main') {
                            const top = Math.min(0, ...Object.values(cards).map((point) => point.y))
                            cards[paneKey] = { x: 0, y: top - 172 }
                          }
                          return { ...tab, cards }
                        })
                      }
                    }
                  }
                })
                setOpen(false)
              } catch {
                toast.error(
                  t(
                    'agentCanvas.coordinatorLaunchFailed',
                    'Could not link the coordinator. Check the launched agent.'
                  )
                )
              } finally {
                setPending(false)
              }
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

/** A chat's launch tab is provisional; its card key only exists once the session settles. */
export async function waitForCoordinatorPane(
  terminalTabId: string | null,
  settlement: Promise<StructuredAgentLaunchSettlement> | undefined
): Promise<string> {
  let sessionId: string | null = null
  if (!terminalTabId) {
    const settled = await settlement
    if (settled?.kind !== 'structured' && settled?.kind !== 'visibility-unknown') {
      throw new Error('Chat launch did not settle')
    }
    sessionId = settled.sessionId
  }
  return new Promise((resolve, reject) => {
    const read = (): string | undefined => {
      const state = useAppStore.getState()
      if (sessionId) {
        const chats = getStructuredAgentSessionTabsByPaneKey(state.unifiedTabsByWorktree)
        return [...chats].find(([, tab]) => tab.entityId === sessionId)?.[0]
      }
      const leaf = terminalTabId ? state.terminalLayoutsByTabId[terminalTabId]?.activeLeafId : null
      return leaf ? `${terminalTabId}:${leaf}` : undefined
    }
    const initial = read()
    if (initial) {
      resolve(initial)
      return
    }
    const timer = setTimeout(() => {
      unsubscribe()
      reject(new Error('Pane unavailable'))
    }, 30000)
    const unsubscribe = useAppStore.subscribe(() => {
      const pane = read()
      if (pane) {
        clearTimeout(timer)
        unsubscribe()
        resolve(pane)
      }
    })
  })
}
