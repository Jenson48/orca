import { useRef, useState } from 'react'
import { Layers } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { useTranslate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '@/components/ui/select'
import { AgentLaunchPicker } from '@/components/agent/AgentLaunchPicker'
import { useNewTabAgentMenuRows } from '@/components/tab-bar/use-new-tab-agent-menu-rows'
import { useAgentDetectionTargetForWorktree } from '@/hooks/useAgentDetectionTarget'
import { launchAgentInNewTab } from '@/lib/agent-session/launch/new-tab/launch-agent-in-new-tab'
import { newAgentLaunchRequestId } from '@/lib/agent-session/launch/routing/agent-launch-request-id'
import { waitForCoordinatorPane } from './CanvasCoordinator'
import { placeAgentCanvasRow } from '../../../../../shared/agent-canvas-layout'

export function CanvasBatchLaunch({ repoId }: { repoId: string }): React.JSX.Element {
  const composing = useRef(false)
  const t = useTranslate()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [count, setCount] = useState(3)
  const [prompt, setPrompt] = useState('')
  const [target, setTarget] = useState('')
  const worktrees = useAppStore((s) => s.worktreesByRepo[repoId])
  const active = useAppStore((s) => s.activeWorktreeId)
  const worktree =
    worktrees?.find((w) => w.id === target) ??
    worktrees?.find((w) => w.id === active) ??
    worktrees?.find((w) => w.isMainWorktree) ??
    worktrees?.[0]
  const detection = useAgentDetectionTargetForWorktree(worktree?.id ?? null)
  const model = useNewTabAgentMenuRows(worktree?.id ?? '', open, detection)
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        disabled={!worktree}
        title={t('agentCanvas.launchAgents', 'Launch agents')}
        onClick={() => setOpen(true)}
      >
        <Layers className="size-4" />
        {t('agentCanvas.launchAgents', 'Launch agents')}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!pending) {
            setOpen(value)
          }
        }}
      >
        <DialogContent
          onCompositionStart={() => {
            composing.current = true
          }}
          onCompositionEnd={() => {
            composing.current = false
          }}
          onEscapeKeyDown={(e) => {
            if (composing.current || e.isComposing || pending) {
              e.preventDefault()
            }
          }}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle>{t('agentCanvas.launchAgents', 'Launch agents')}</DialogTitle>
          </DialogHeader>
          <Input
            type="number"
            min={1}
            max={8}
            value={count}
            disabled={pending}
            aria-label={t('agentCanvas.count', 'Number of agents')}
            onChange={(e) => setCount(Math.max(1, Math.min(8, Number(e.target.value) || 1)))}
          />
          <Select value={worktree?.id} onValueChange={setTarget} disabled={pending}>
            <SelectTrigger aria-label={t('agentCanvas.workspace', 'Workspace')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {worktrees?.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.displayName || w.path}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            value={prompt}
            disabled={pending}
            aria-label={t('agentCanvas.sharedPrompt', 'Shared initial prompt (optional)')}
            placeholder={t('agentCanvas.sharedPrompt', 'Shared initial prompt (optional)')}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <AgentLaunchPicker
            model={model}
            agent={null}
            worktreeId={worktree?.id}
            disabled={pending}
            onPick={async (agent) => {
              if (!worktree || pending) {
                return
              }
              setPending(true)
              const tabId =
                useAppStore.getState().agentCanvas.projects[repoId]?.activeTabId ?? 'main'
              const keys: string[] = []
              for (let i = 0; i < count; i++) {
                try {
                  const result = launchAgentInNewTab({
                    requestId: newAgentLaunchRequestId(),
                    agent,
                    worktreeId: worktree.id,
                    prompt,
                    promptDelivery: 'submit-after-ready'
                  })
                  if (!result || 'refused' in result || result.surface.kind === 'host-published') {
                    continue
                  }
                  keys.push(
                    await waitForCoordinatorPane(
                      result.surface.kind === 'local-chat' ? null : result.surface.tabId,
                      result.structuredSettlement
                    )
                  )
                } catch {
                  /* Continue launching the remaining agents. */
                }
              }
              useAppStore.getState().updateAgentCanvas((layout) => {
                const project = layout.projects[repoId]
                return project
                  ? {
                      ...layout,
                      projects: {
                        ...layout.projects,
                        [repoId]: placeAgentCanvasRow(project, tabId, keys)
                      }
                    }
                  : layout
              })
              toast(
                t('agentCanvas.launchedCount', 'Launched {{count}} of {{total}} agents', {
                  count: keys.length,
                  total: count
                })
              )
              setPending(false)
              setOpen(false)
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
