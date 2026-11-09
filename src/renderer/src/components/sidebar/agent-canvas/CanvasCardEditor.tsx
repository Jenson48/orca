import { useState, useRef } from 'react'
import { Bot, Code, Terminal, Star, Zap, Book, Search, Wrench } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useTranslate } from '@/i18n/use-translate'
import {
  canvasCardHues,
  canvasCardIcons,
  type CanvasCardStyle
} from '../../../../../shared/agent-canvas-card-styles'

export const cardIcons = {
  bot: Bot,
  code: Code,
  terminal: Terminal,
  star: Star,
  zap: Zap,
  book: Book,
  search: Search,
  wrench: Wrench
}
export function CanvasCardEditor({
  mode,
  style,
  save,
  close
}: {
  mode: 'appearance' | 'note'
  style: CanvasCardStyle
  save: (style: CanvasCardStyle) => void
  close: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const [draft, setDraft] = useState(style)
  const composing = useRef(false)
  const submit = (): void => {
    save(draft)
    close()
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          close()
        }
      }}
    >
      <DialogContent
        onClick={(e) => e.stopPropagation()}
        onEscapeKeyDown={(e) => {
          if (composing.current || e.isComposing) {
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
            !composing.current &&
            !e.nativeEvent.isComposing &&
            e.keyCode !== 229 &&
            e.key === 'Enter' &&
            (e.metaKey || e.ctrlKey)
          ) {
            e.preventDefault()
            submit()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {mode === 'note'
              ? t('agentCanvas.note', 'Note…')
              : t('agentCanvas.appearance', 'Appearance…')}
          </DialogTitle>
        </DialogHeader>
        {mode === 'note' ? (
          <Textarea
            aria-label={t('agentCanvas.note', 'Note…')}
            maxLength={500}
            value={draft.note ?? ''}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          />
        ) : (
          <>
            <Input
              aria-label={t('agentCanvas.cardName', 'Card name')}
              placeholder={t('agentCanvas.defaultName', 'Default title')}
              maxLength={80}
              value={draft.name ?? ''}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                aria-pressed={!draft.color}
                onClick={() => setDraft({ ...draft, color: undefined })}
              >
                {t('agentCanvas.default', 'Default')}
              </Button>
              {canvasCardHues.map((color) => (
                <Button
                  key={color}
                  variant="outline"
                  aria-label={t(`agentCanvas.color.${color}`, color)}
                  aria-pressed={draft.color === color}
                  onClick={() => setDraft({ ...draft, color })}
                >
                  <span
                    className="size-4 rounded-full"
                    style={{ background: `var(--color-${color}-500)` }}
                  />
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                aria-pressed={!draft.icon}
                onClick={() => setDraft({ ...draft, icon: undefined })}
              >
                {t('agentCanvas.default', 'Default')}
              </Button>
              {canvasCardIcons.map((icon) => {
                const Icon = cardIcons[icon]
                return (
                  <Button
                    key={icon}
                    variant="outline"
                    aria-label={t(`agentCanvas.icon.${icon}`, icon)}
                    aria-pressed={draft.icon === icon}
                    onClick={() => setDraft({ ...draft, icon })}
                  >
                    <Icon className="size-4" />
                  </Button>
                )
              })}
            </div>
          </>
        )}
        <Button onClick={submit}>{t('agentCanvas.save', 'Save')}</Button>
      </DialogContent>
    </Dialog>
  )
}
