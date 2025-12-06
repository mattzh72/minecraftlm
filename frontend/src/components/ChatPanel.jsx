import { useState, useRef, useEffect, useCallback } from 'react';
import useSessionStore from '../store/sessionStore';
import useAutoScroll from '../hooks/useAutoScroll';
import useInitialMessage from '../hooks/useInitialMessage';

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
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: '16px 20px 20px',
      backgroundColor: 'transparent',
      color: '#1f2933',
    }}>
      <h2 style={{ marginTop: 0, marginBottom: '16px', color: '#111827', fontSize: '18px' }}>
        Minecraft Builder
      </h2>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        marginBottom: '16px',
        padding: '10px',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
      }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{ marginBottom: '15px' }}>
            {msg.role === 'user' && (
              <div style={{
                padding: '10px',
                backgroundColor: '#f3f4f6',
                borderRadius: '8px',
                borderLeft: '3px solid #4CAF50',
              }}>
                <strong style={{ color: '#16a34a' }}>You:</strong>
                <div style={{ marginTop: '5px' }}>{msg.content}</div>
              </div>
            )}

            {msg.role === 'agent' && (
              <div style={{
                padding: '10px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                borderLeft: '3px solid #2196F3',
              }}>
                <strong style={{ color: '#1d4ed8' }}>Agent:</strong>
                {msg.activities.map((activity, actIdx) => (
                  <div key={actIdx} style={{ marginTop: '8px', fontSize: '0.9em' }}>
                    {activity.type === 'thought' && (
                      <div style={{ color: '#4b5563', fontStyle: 'italic' }}>
                        💭 {activity.content}
                      </div>
                    )}
                    {activity.type === 'tool_call' && (
                      <div style={{ color: '#ea580c' }}>
                        🔧 Calling {activity.name}
                        {Object.keys(activity.args || {}).length > 0 && (
                          <pre style={{
                            marginTop: '5px',
                            padding: '6px',
                            backgroundColor: '#f3f4f6',
                            borderRadius: '6px',
                            fontSize: '0.85em',
                            overflow: 'auto',
                          }}>
                            {JSON.stringify(activity.args, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                    {activity.type === 'tool_result' && (
                      <div style={{ color: '#16a34a' }}>
                        ✓ Result:
                        <pre style={{
                          marginTop: '5px',
                          padding: '6px',
                          backgroundColor: '#f3f4f6',
                          borderRadius: '6px',
                          fontSize: '0.85em',
                          overflow: 'auto',
                        }}>
                          {JSON.stringify(activity.result, null, 2)}
                        </pre>
                      </div>
                    )}
                    {activity.type === 'complete' && (
                      <div style={{
                        color: activity.success ? '#16a34a' : '#ef4444',
                        fontWeight: 'bold',
                        marginTop: '8px',
                      }}>
                        {activity.success ? '✓' : '✗'} {activity.message}
                      </div>
                    )}
                    {activity.type === 'error' && (
                      <div style={{ color: '#b91c1c' }}>
                        ⚠ Error: {activity.message}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {msg.role === 'error' && (
              <div style={{
                padding: '10px',
                backgroundColor: '#fef2f2',
                borderRadius: '8px',
                borderLeft: '3px solid #ef4444',
                color: '#b91c1c',
              }}>
                {msg.content}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe your Minecraft structure..."
          disabled={isLoading || !sessionId}
          style={{
            flex: 1,
            padding: '12px',
            backgroundColor: '#ffffff',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            color: '#111827',
            fontSize: '14px',
          }}
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !sessionId || !input.trim()}
          style={{
            padding: '12px 24px',
            backgroundColor: isLoading || !sessionId || !input.trim() ? '#e5e7eb' : '#16a34a',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: isLoading || !sessionId || !input.trim() ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
          }}
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
