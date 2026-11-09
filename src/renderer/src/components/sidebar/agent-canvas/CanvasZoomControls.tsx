import { useReactFlow, useViewport } from '@xyflow/react'
import { Bell, Grid2X2, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslate } from '@/i18n/use-translate'
import { getShortcutPlatform } from '@/hooks/useShortcutLabel'
import { formatKeybinding } from '../../../../../shared/keybindings'
import { ShortcutKeyCombo } from '@/components/ShortcutKeyCombo'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

export function ZoomControls({
  snapToGrid,
  onToggleSnap,
  onNextAttention
}: {
  snapToGrid?: boolean
  onToggleSnap?: () => void
  onNextAttention?: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const flow = useReactFlow()
  const { zoom } = useViewport()
  return (
    <div className="flex items-center rounded-md border border-border bg-card font-mono text-[11px] shadow-xs">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-pressed={!!snapToGrid}
            onClick={onToggleSnap}
            aria-label={t('agentCanvas.snapToGrid', 'Snap to grid')}
          >
            <Grid2X2 className="size-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('agentCanvas.snapToGrid', 'Snap to grid')}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={!onNextAttention}
            onClick={onNextAttention}
            aria-label={t('agentCanvas.nextAttention', 'Next agent needing me')}
          >
            <Bell className="size-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          {t('agentCanvas.nextAttention', 'Next agent needing me')}
          <ShortcutKeyCombo
            className="ml-2"
            keys={formatKeybinding('Alt+N', getShortcutPlatform())}
          />
        </TooltipContent>
      </Tooltip>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={t('agentCanvas.zoomOut', 'Zoom out')}
        onClick={() => void flow.zoomOut({ duration: 150 })}
      >
        <Minus className="size-3" />
      </Button>
      <span className="w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={t('agentCanvas.zoomIn', 'Zoom in')}
        onClick={() => void flow.zoomIn({ duration: 150 })}
      >
        <Plus className="size-3" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="rounded-l-none border-l border-border px-2 font-mono text-[11px]"
        onClick={() => void flow.fitView({ duration: 200, maxZoom: 1, padding: 0.2 })}
      >
        {t('agentCanvas.fit', 'Fit')}
      </Button>
    </div>
  )
}
