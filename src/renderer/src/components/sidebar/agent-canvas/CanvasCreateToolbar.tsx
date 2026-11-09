import { CanvasBatchLaunch } from './CanvasBatchLaunch'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslate } from '@/i18n/use-translate'

export function CanvasCreateToolbar({
  repoId,
  onAgent,
  onCreate
}: {
  repoId?: string
  onAgent?: () => void
  onCreate: (type: 'text' | 'frame') => void
}): React.JSX.Element {
  const t = useTranslate()
  return (
    <div className="flex gap-1">
      {onAgent && (
        <Button size="sm" className="h-7 gap-1 text-xs" onClick={onAgent}>
          <Plus className="size-3.5" />
          {t('agentCanvas.addAgent', 'Agent')}
        </Button>
      )}
      {repoId && <CanvasBatchLaunch repoId={repoId} />}
      {(['text', 'frame'] as const).map((type) => (
        <Tooltip key={type}>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              aria-label={t(
                type === 'text' ? 'agentCanvas.text' : 'agentCanvas.area',
                type === 'text' ? 'Text' : 'Area'
              )}
              onClick={() => onCreate(type)}
            >
              {t(
                type === 'text' ? 'agentCanvas.text' : 'agentCanvas.area',
                type === 'text' ? 'Text' : 'Area'
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {t(
              type === 'text' ? 'agentCanvas.text' : 'agentCanvas.area',
              type === 'text' ? 'Text' : 'Area'
            )}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}
