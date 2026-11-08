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
        {coordinator ? null : label}
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
                const tabId = result.surface.tabId
                const paneKey = await waitForCoordinatorPane(tabId)
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

function waitForCoordinatorPane(tabId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const read = (): string | undefined => {
      const state = useAppStore.getState()
      const chat = [...getStructuredAgentSessionTabsByPaneKey(state.unifiedTabsByWorktree)].find(
        ([, tab]) => tab.id === tabId
      )
      if (chat) {
        return chat[0]
      }
      const leaf = state.terminalLayoutsByTabId[tabId]?.activeLeafId
      return leaf ? `${tabId}:${leaf}` : undefined
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
