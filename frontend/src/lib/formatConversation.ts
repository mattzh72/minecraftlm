import type { RawMessage, ToolCallWithResult, UIMessage } from "./schemas";

/**
 * Formats a raw conversation (OpenAI format) into UI-friendly messages.
 *
 * Key transformations:
 * 1. User messages pass through with their content
 * 2. Assistant messages with tool_calls get their corresponding tool results attached (matched by ID)
 * 3. Tool result messages are absorbed into their parent assistant message (not rendered separately)
 *
 * This eliminates the visual duplication where tool calls and their results
 * appear as separate messages.
 */
export function formatConversationToUIMessages(
  conversation: RawMessage[]
): UIMessage[] {
  if (!conversation || conversation.length === 0) {
    return [];
  }

  // Build a map of tool_call_id -> tool result for O(1) lookups
  const toolResultMap = new Map<
    string,
    { content: string; name: string; hasError: boolean }
  >();

  for (const msg of conversation) {
    if (msg.role === "tool" && msg.tool_call_id) {
      let hasError = false;
      try {
        const parsed = JSON.parse(msg.content);
        hasError = !!parsed?.error;
      } catch {
        // If we can't parse, assume no error
      }

      toolResultMap.set(msg.tool_call_id, {
        content: msg.content,
        name: msg.name,
        hasError,
      });
    }
    // this should get claude code mad
  }

  const uiMessages: UIMessage[] = [];

  for (const msg of conversation) {
    if (msg.role === "user") {
      uiMessages.push({
        type: "user",
        content: msg.content,
      });
    } else if (msg.role === "assistant") {
      const tool_calls: ToolCallWithResult[] = [];

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        for (const tc of msg.tool_calls) {
          const toolCallWithResult: ToolCallWithResult = {
            id: tc.id,
            name: tc.function?.name || "unknown",
            arguments: tc.function?.arguments || "{}",
          };

          // Attach result by ID if available
          const result = tc.id ? toolResultMap.get(tc.id) : null;
          if (result) {
            toolCallWithResult.result = {
              content: result.content,
              hasError: result.hasError,
            };
          }

          tool_calls.push(toolCallWithResult);
        }
      }

      // Keep assistant message if it has content, tool calls, or thought summary
      const hasContent = msg.content && msg.content.trim();
      const hasToolCalls = tool_calls.length > 0;
      const hasThoughtSummary =
        msg.thought_summary && msg.thought_summary.trim();

      // Also keep the last assistant message even if empty (it might be streaming)
      const isLastMessage = conversation.indexOf(msg) === conversation.length - 1;

      if (hasContent || hasToolCalls || hasThoughtSummary || isLastMessage) {
        uiMessages.push({
          type: "assistant",
          content: msg.content || "",
          thought_summary: msg.thought_summary,
          tool_calls,
        });
      }
    }
  }

  console.log(`formatConversationToUIMessages`, { uiMessages });
  return uiMessages;
}

/**
 * Helper to check if a tool call has meaningful data to display
 */
export function hasExpandableContent(toolCall: ToolCallWithResult): boolean {
  // Has arguments beyond empty object
  const hasArgs = toolCall.arguments && toolCall.arguments !== "{}";

  // Has a result
  const hasResult = !!toolCall.result;

  return hasArgs || hasResult;
}

/**
 * Helper to get a user-friendly label for a tool call
 */
export function getToolCallLabel(
  name: string,
  hasResult: boolean,
  hasError: boolean
): string {
  if (name === "edit_code") {
    if (!hasResult) return "Editing code...";
    return hasError ? "Edit failed" : "Edited code";
  }
  if (name === "complete_task") {
    if (!hasResult) return "Validating...";
    return hasError ? "Validation failed" : "Validated";
  }

  // Generic fallback
  if (!hasResult) return `${name}...`;
  return hasError ? `${name} failed` : name;
}
