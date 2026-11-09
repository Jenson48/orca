export const canvasCardHues = [
  'sky',
  'emerald',
  'violet',
  'rose',
  'fuchsia',
  'orange',
  'purple',
  'green',
  'blue',
  'amber'
] as const
export const canvasCardIcons = [
  'bot',
  'code',
  'terminal',
  'star',
  'zap',
  'book',
  'search',
  'wrench'
] as const
export type CanvasCardStyle = {
  name?: string
  note?: string
  color?: (typeof canvasCardHues)[number]
  icon?: (typeof canvasCardIcons)[number]
}
export function normalizeCardStyles(value: unknown): Record<string, CanvasCardStyle> {
  const result: Record<string, CanvasCardStyle> = {}
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return result
  }
  for (const [key, raw] of Object.entries(value)) {
    if (!raw || typeof raw !== 'object') {
      continue
    }
    const style: CanvasCardStyle = {}
    if (typeof raw.name === 'string' && raw.name.trim()) {
      style.name = raw.name.trim().slice(0, 80)
    }
    if (typeof raw.note === 'string' && raw.note.trim()) {
      style.note = raw.note.trim().slice(0, 500)
    }
    if (canvasCardHues.includes(raw.color)) {
      style.color = raw.color
    }
    if (canvasCardIcons.includes(raw.icon)) {
      style.icon = raw.icon
    }
    if (Object.keys(style).length) {
      result[key] = style
    }
  }
  return result
}
