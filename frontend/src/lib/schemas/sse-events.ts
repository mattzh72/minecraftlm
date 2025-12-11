import { z } from "zod";

export const turnStartEvent = z.object({
  type: z.literal("turn_start"),
});

export const thoughtEvent = z.object({
  type: z.literal("thought"),
  data: z.object({
    delta: z.string(),
  }),
});

export const textDeltaEvent = z.object({
  type: z.literal("text_delta"),
  data: z.object({
    delta: z.string(),
  }),
});

export const toolCallEvent = z.object({
  type: z.literal("tool_call"),
  data: z.object({
    name: z.string(),
    args: z.unknown(),
  }),
});

export const toolResultEvent = z.object({
  type: z.literal("tool_result"),
  data: z.object({
    result: z.string(),
  }),
});

export const completeEvent = z.object({
  type: z.literal("complete"),
  data: z.object({
    success: z.boolean(),
    reason: z.string().optional(),
  }),
});

export const errorEvent = z.object({
  type: z.literal("error"),
  data: z.object({
    message: z.string(),
  }),
});

export const blockPreviewEvent = z.object({
  type: z.literal("block_preview"),
  data: z.object({
    block: z.object({
      start: z.tuple([z.number(), z.number(), z.number()]),
      end: z.tuple([z.number(), z.number(), z.number()]),
      type: z.string(),
      properties: z.record(z.string()).optional(),
      fill: z.boolean(),
      variable_name: z.string().nullable().optional(), // For deduplication
    }),
  }),
});

export const sseEvent = z.discriminatedUnion("type", [
  turnStartEvent,
  thoughtEvent,
  textDeltaEvent,
  toolCallEvent,
  toolResultEvent,
  completeEvent,
  errorEvent,
  blockPreviewEvent,
]);

export type SSEEvent = z.infer<typeof sseEvent>;
export type TurnStartEvent = z.infer<typeof turnStartEvent>;
export type ThoughtEvent = z.infer<typeof thoughtEvent>;
export type TextDeltaEvent = z.infer<typeof textDeltaEvent>;
export type ToolCallEvent = z.infer<typeof toolCallEvent>;
export type ToolResultEvent = z.infer<typeof toolResultEvent>;
export type CompleteEvent = z.infer<typeof completeEvent>;
export type ErrorEvent = z.infer<typeof errorEvent>;
export type BlockPreviewEvent = z.infer<typeof blockPreviewEvent>;
