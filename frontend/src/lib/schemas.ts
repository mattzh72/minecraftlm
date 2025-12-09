import { z } from "zod";

/**
 * Schemas for raw conversation messages (OpenAI format)
 */
export const toolCallFunctionSchema = z.object({
  name: z.string(),
  arguments: z.string(),
});

export const toolCallSchema = z.object({
  id: z.string().nullish(),
  type: z.literal("function"),
  function: toolCallFunctionSchema,
  thought_signature: z.string().nullish(),
  extra_content: z.record(z.string(), z.unknown()).optional(),
});

export const rawUserMessageSchema = z.object({
  role: z.literal("user"),
  content: z.string(),
});

export const rawAssistantMessageSchema = z.object({
  role: z.literal("assistant"),
  content: z.string(),
  thought_summary: z.string().nullish(),
  tool_calls: z.array(toolCallSchema).optional(),
});

export const rawToolMessageSchema = z.object({
  role: z.literal("tool"),
  tool_call_id: z.string(),
  content: z.string(),
  name: z.string(),
});

export const rawMessageSchema = z.discriminatedUnion("role", [
  rawUserMessageSchema,
  rawAssistantMessageSchema,
  rawToolMessageSchema,
]);

export const rawConversationSchema = z.array(rawMessageSchema);

/**
 * Schemas for UI-friendly messages
 */
export const toolCallResultSchema = z.object({
  content: z.string(),
  hasError: z.boolean(),
});

export const toolCallWithResultSchema = z.object({
  id: z.string().nullish(),
  name: z.string(),
  arguments: z.string(),
  result: toolCallResultSchema.optional(),
});

export const uiUserMessageSchema = z.object({
  type: z.literal("user"),
  content: z.string(),
});

export const uiAssistantMessageSchema = z.object({
  type: z.literal("assistant"),
  content: z.string(),
  thought_summary: z.string().nullish(),
  tool_calls: z.array(toolCallWithResultSchema),
});

export const uiMessageSchema = z.discriminatedUnion("type", [
  uiUserMessageSchema,
  uiAssistantMessageSchema,
]);

export const uiConversationSchema = z.array(uiMessageSchema);

/**
 * Inferred types from schemas
 */
export type ToolCall = z.infer<typeof toolCallSchema>;
export type RawUserMessage = z.infer<typeof rawUserMessageSchema>;
export type RawAssistantMessage = z.infer<typeof rawAssistantMessageSchema>;
export type RawToolMessage = z.infer<typeof rawToolMessageSchema>;
export type RawMessage = z.infer<typeof rawMessageSchema>;
export type RawConversation = z.infer<typeof rawConversationSchema>;
export type ToolCallResult = z.infer<typeof toolCallResultSchema>;
export type ToolCallWithResult = z.infer<typeof toolCallWithResultSchema>;
export type UIUserMessage = z.infer<typeof uiUserMessageSchema>;
export type UIAssistantMessage = z.infer<typeof uiAssistantMessageSchema>;
export type UIMessage = z.infer<typeof uiMessageSchema>;
export type UIConversation = z.infer<typeof uiConversationSchema>;
