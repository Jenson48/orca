import { z } from 'zod'

export const agentCanvasItemFields = {
  items: z
    .record(
      z.string(),
      z.object({
        type: z.enum(['text', 'frame']),
        x: z.number().finite(),
        y: z.number().finite(),
        text: z.string(),
        width: z.number().finite().positive().optional(),
        height: z.number().finite().positive().optional(),
        style: z.enum(['heading', 'body']).optional(),
        color: z.string().optional()
      })
    )
    .optional(),
  edges: z
    .array(
      z.object({
        id: z.string(),
        source: z.string(),
        target: z.string(),
        label: z.string().optional()
      })
    )
    .optional()
}
