import { z } from "zod";

export const createSessionResponseSchema = z.object({
  session_id: z.string(),
});

/**
 * Schemas for raw conversation messages (OpenAI format)
 */
export const sessionLiteSchema = z.object({
  session_id: z.string(),
  has_structure: z.boolean(),
  has_thumbnail: z.boolean().optional().default(false),
  message_count: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const listSessionsResponseSchema = z.object({
  sessions: z.array(sessionLiteSchema),
});

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
  thinking_signature: z.string().nullish(), // Anthropic thinking block signature
  tool_calls: z.array(toolCallSchema).nullish(),
});

export const rawToolMessageSchema = z.object({
  role: z.literal("tool"),
  tool_call_id: z.string().nullish(),
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
})

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

const structureDataSchema = z.record(z.string(), z.unknown()).nullish().default(null);
export const sessionDetailsResponseSchema = z.object({
  session_id: z.string(),
  conversation: rawConversationSchema,
  structure: structureDataSchema,
  model: z.string().nullish(),
});

export const storeSessionSchema = sessionLiteSchema.extend({
  conversation: rawConversationSchema.nullish().default([]),
  structure: structureDataSchema,
});

const providerSchema = z.enum(["gemini", "openai", "anthropic"]);

export const modelSchema = z.object({
  id: z.string(),
  provider: providerSchema,
});

export const thinkingLevelSchema = z.enum(["low", "med", "high"]);
export type ThinkingLevel = z.infer<typeof thinkingLevelSchema>;

export const modelsResponseSchema = z.object({
  models: z.array(modelSchema),
  default: z.string(),
});

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
export type SessionLite = z.infer<typeof sessionLiteSchema>;
export type ListSessionsResponse = z.infer<typeof listSessionsResponseSchema>;
export type StoreSession = z.infer<typeof storeSessionSchema>;
export type Model = z.infer<typeof modelSchema>;
export type ModelsResponse = z.infer<typeof modelsResponseSchema>;
export type ModelProvider = z.infer<typeof providerSchema>;
