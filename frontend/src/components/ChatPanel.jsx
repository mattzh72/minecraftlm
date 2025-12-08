import { useState, useRef, useEffect, useCallback } from 'react';
import { cva } from 'class-variance-authority';
import useSessionStore from '../store/sessionStore';
import useAutoScroll from '../hooks/useAutoScroll';
import useInitialMessage from '../hooks/useInitialMessage';

// Message bubble variants
const messageBubble = cva('p-2.5 rounded-lg', {
  variants: {
    role: {
      user: 'bg-gray-100',
      agent: 'bg-gray-50',
      error: 'bg-red-50 text-red-700',
    },
  },
});

// Activity type variants
const activityText = cva('', {
  variants: {
    type: {
      thought: 'text-gray-600 italic',
      tool_call: 'text-orange-600',
      tool_result: 'text-green-600',
      error: 'text-red-700',
    },
  },
});

export default function ChatPanel() {
  const sessionId = useSessionStore((state) => state.sessionId);
  const conversation = useSessionStore((state) => state.conversation);
  const setStructureData = useSessionStore((state) => state.setStructureData);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Ref to accumulate activities during streaming (avoids StrictMode double-invoke issues)
  const activitiesRef = useRef([]);
  const abortControllerRef = useRef(null);
  const requestIdRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Restore messages from conversation when session is loaded
  useEffect(() => {
    if (conversation && conversation.length > 0) {
      const restoredMessages = [];
      let currentAgentMessage = null;

      for (const msg of conversation) {
        if (msg.role === 'user') {
          // Flush any pending agent message
          if (currentAgentMessage && currentAgentMessage.activities.length > 0) {
            restoredMessages.push(currentAgentMessage);
            currentAgentMessage = null;
          }
          restoredMessages.push({ role: 'user', content: msg.content });
        } else if (msg.role === 'assistant') {
          // Start new agent message if needed
          if (!currentAgentMessage) {
            currentAgentMessage = { role: 'agent', activities: [] };
          }

          // Add thought if there's text content
          if (msg.content && msg.content.trim()) {
            currentAgentMessage.activities.push({ type: 'thought', content: msg.content });
          }

          // Add tool calls
          if (msg.tool_calls) {
            for (const toolCall of msg.tool_calls) {
              const args = JSON.parse(toolCall.function.arguments);
              currentAgentMessage.activities.push({
                type: 'tool_call',
                name: toolCall.function.name,
                args: args
              });
            }
          }
        } else if (msg.role === 'tool') {
          // Tool result
          if (!currentAgentMessage) {
            currentAgentMessage = { role: 'agent', activities: [] };
          }

          const result = JSON.parse(msg.content);
          currentAgentMessage.activities.push({
            type: 'tool_result',
            result: result
          });
        }
      }

      // Flush any remaining agent message
      if (currentAgentMessage && currentAgentMessage.activities.length > 0) {
        restoredMessages.push(currentAgentMessage);
      }

      setMessages(restoredMessages);
    }
  }, [conversation]);

  const messagesEndRef = useAutoScroll([messages]);

  const handleSend = useCallback(async (messageText = null) => {
    // Use provided message or input state
    const userMessage = messageText || input;

    if (!userMessage.trim() || !sessionId || isLoading) return;

    setInput('');

    // Add user message and empty agent message
    const newMessages = [
      ...messages,
      { role: 'user', content: userMessage },
      { role: 'agent', activities: [] }
    ];
    setMessages(newMessages);
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsLoading(true);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Reset activities ref for this streaming session
    activitiesRef.current = [];
    const agentMessageIndex = newMessages.length - 1;

    // Helper to sync activities from ref to state
    const syncActivities = () => {
      setMessages(prev => {
        const updated = [...prev];
        if (updated[agentMessageIndex]?.role === 'agent') {
          updated[agentMessageIndex] = {
            ...updated[agentMessageIndex],
            activities: [...activitiesRef.current]
          };
        }
        return updated;
      });
    };

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          message: userMessage,
        }),
        signal: abortController.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Chat request failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        let hasNewActivity = false;

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              let activity = null;

              if (data.type === 'text_delta') {
                // Append to the last thought activity or create new one
                const lastActivity = activitiesRef.current[activitiesRef.current.length - 1];
                if (lastActivity && lastActivity.type === 'thought') {
                  lastActivity.content += data.data.delta;
                } else {
                  activitiesRef.current.push({ type: 'thought', content: data.data.delta });
                }
                hasNewActivity = true;
              } else if (data.type === 'thought') {
                activity = { type: 'thought', content: data.data.text };
              } else if (data.type === 'tool_call') {
                activity = { type: 'tool_call', name: data.data.name, args: data.data.args };
              } else if (data.type === 'tool_result') {
                activity = { type: 'tool_result', result: data.data };
              } else if (data.type === 'complete') {
                activity = { type: 'complete', success: data.data.success, message: data.data.message };

                // Fetch the updated structure
                if (data.data.success) {
                  try {
                    const structureRes = await fetch(`/api/sessions/${sessionId}/structure`);
                    if (structureRes.ok) {
                      const structureData = await structureRes.json();
                      setStructureData(structureData);
                    }
                  } catch (err) {
                    console.error('Error fetching structure:', err);
                  }
                }
              } else if (data.type === 'turn_start') {
                activity = { type: 'turn_start', turn: data.data.turn };
              } else if (data.type === 'error') {
                activity = { type: 'error', message: data.data.message };
              }

              if (activity) {
                activitiesRef.current.push(activity);
                hasNewActivity = true;
              }
            } catch (parseErr) {
              console.error('Error parsing SSE data:', parseErr, line);
            }
          }
        }

        // Batch update: sync to state once per chunk (not per event)
        if (hasNewActivity) {
          syncActivities();
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      if (isMountedRef.current && requestIdRef.current === requestId) {
        setMessages(prev => [...prev, {
          role: 'error',
          content: error.name === 'AbortError'
            ? 'Request was cancelled.'
            : `Error: ${error.message}`
        }]);
      }
    } finally {
      if (isMountedRef.current && requestIdRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }, [sessionId, isLoading, input, messages, setStructureData]);

  // Handle initial message from homepage chat bar
  useInitialMessage(sessionId, messages.length, isLoading, handleSend);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full overflow-hidden p-3 pb-4 bg-transparent text-gray-800 gap-3">
      {/* Messages container */}
      <div className="flex-1 overflow-y-auto min-h-0 p-2.5 bg-white rounded-xl border border-gray-200">
        {messages.map((msg, idx) => (
          <div key={idx} className="mb-4">
            {msg.role === 'user' && (
              <div className={messageBubble({ role: 'user' })}>
                <strong className="text-green-600">You:</strong>
                <div className="mt-1">{msg.content}</div>
              </div>
            )}

            {msg.role === 'agent' && (
              <div className={messageBubble({ role: 'agent' })}>
                <strong className="text-blue-700">Agent:</strong>
                {msg.activities.map((activity, actIdx) => (
                  <div key={actIdx} className="mt-2 text-sm">
                    {activity.type === 'thought' && (
                      <div className={activityText({ type: 'thought' })}>
                        💭 {activity.content}
                      </div>
                    )}
                    {activity.type === 'tool_call' && (
                      <div className={activityText({ type: 'tool_call' })}>
                        🔧 Calling {activity.name}
                        {Object.keys(activity.args || {}).length > 0 && (
                          <pre className="mt-1 p-1.5 bg-gray-100 rounded-md text-xs overflow-auto">
                            {JSON.stringify(activity.args, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                    {activity.type === 'tool_result' && (
                      <div className={activityText({ type: 'tool_result' })}>
                        ✓ Result:
                        <pre className="mt-1 p-1.5 bg-gray-100 rounded-md text-xs overflow-auto">
                          {JSON.stringify(activity.result, null, 2)}
                        </pre>
                      </div>
                    )}
                    {activity.type === 'complete' && (
                      <div className={`font-bold mt-2 ${activity.success ? 'text-green-600' : 'text-red-500'}`}>
                        {activity.success ? '✓' : '✗'} {activity.message}
                      </div>
                    )}
                    {activity.type === 'error' && (
                      <div className={activityText({ type: 'error' })}>
                        ⚠ Error: {activity.message}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {msg.role === 'error' && (
              <div className={messageBubble({ role: 'error' })}>
                {msg.content}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="flex gap-2.5">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe your Minecraft structure..."
          disabled={isLoading || !sessionId}
          className="flex-1 p-3 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !sessionId || !input.trim()}
          className="px-6 py-3 bg-green-600 text-white border-none rounded-lg cursor-pointer text-sm font-bold hover:bg-green-700 disabled:bg-gray-200 disabled:cursor-not-allowed disabled:text-gray-400"
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
