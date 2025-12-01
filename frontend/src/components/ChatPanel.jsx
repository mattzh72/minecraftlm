import { useState } from 'react';
import useSessionStore from '../store/sessionStore';
import useAutoScroll from '../hooks/useAutoScroll';

export default function ChatPanel() {
  const sessionId = useSessionStore((state) => state.sessionId);
  const setStructureData = useSessionStore((state) => state.setStructureData);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useAutoScroll([messages]);

  const handleSend = async () => {
    if (!input.trim() || !sessionId || isLoading) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

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
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      // Add empty agent message that we'll update progressively
      const agentMessageIndex = messages.length + 1; // +1 for user message we just added
      setMessages(prev => [...prev, { role: 'agent', activities: [] }]);

      // Helper to update the current agent message's activities
      const addActivity = (activity) => {
        setMessages(prev => {
          const updated = [...prev];
          const agentMsg = updated[agentMessageIndex];
          if (agentMsg && agentMsg.role === 'agent') {
            agentMsg.activities = [...agentMsg.activities, activity];
          }
          return updated;
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'thought') {
                addActivity({
                  type: 'thought',
                  content: data.data.text,
                });
              } else if (data.type === 'tool_call') {
                addActivity({
                  type: 'tool_call',
                  name: data.data.name,
                  args: data.data.args,
                });
              } else if (data.type === 'tool_result') {
                addActivity({
                  type: 'tool_result',
                  result: data.data,
                });
              } else if (data.type === 'complete') {
                addActivity({
                  type: 'complete',
                  success: data.data.success,
                  message: data.data.message,
                });

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
                addActivity({
                  type: 'turn_start',
                  turn: data.data.turn,
                });
              } else if (data.type === 'error') {
                addActivity({
                  type: 'error',
                  message: data.data.message,
                });
              }
            } catch (parseErr) {
              console.error('Error parsing SSE data:', parseErr, line);
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        role: 'error',
        content: `Error: ${error.message}`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
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
      padding: '20px',
      backgroundColor: '#1e1e1e',
      color: '#e0e0e0',
    }}>
      <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#4CAF50' }}>
        Minecraft Builder
      </h2>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        marginBottom: '20px',
        padding: '10px',
        backgroundColor: '#2d2d2d',
        borderRadius: '8px',
      }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{ marginBottom: '15px' }}>
            {msg.role === 'user' && (
              <div style={{
                padding: '10px',
                backgroundColor: '#3a3a3a',
                borderRadius: '8px',
                borderLeft: '3px solid #4CAF50',
              }}>
                <strong style={{ color: '#4CAF50' }}>You:</strong>
                <div style={{ marginTop: '5px' }}>{msg.content}</div>
              </div>
            )}

            {msg.role === 'agent' && (
              <div style={{
                padding: '10px',
                backgroundColor: '#2a2a2a',
                borderRadius: '8px',
                borderLeft: '3px solid #2196F3',
              }}>
                <strong style={{ color: '#2196F3' }}>Agent:</strong>
                {msg.activities.map((activity, actIdx) => (
                  <div key={actIdx} style={{ marginTop: '8px', fontSize: '0.9em' }}>
                    {activity.type === 'thought' && (
                      <div style={{ color: '#aaa', fontStyle: 'italic' }}>
                        💭 {activity.content}
                      </div>
                    )}
                    {activity.type === 'tool_call' && (
                      <div style={{ color: '#FFA726' }}>
                        🔧 Calling {activity.name}
                        {Object.keys(activity.args || {}).length > 0 && (
                          <pre style={{
                            marginTop: '5px',
                            padding: '5px',
                            backgroundColor: '#1a1a1a',
                            borderRadius: '4px',
                            fontSize: '0.85em',
                            overflow: 'auto',
                          }}>
                            {JSON.stringify(activity.args, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                    {activity.type === 'tool_result' && (
                      <div style={{ color: '#66BB6A' }}>
                        ✓ Result:
                        <pre style={{
                          marginTop: '5px',
                          padding: '5px',
                          backgroundColor: '#1a1a1a',
                          borderRadius: '4px',
                          fontSize: '0.85em',
                          overflow: 'auto',
                        }}>
                          {JSON.stringify(activity.result, null, 2)}
                        </pre>
                      </div>
                    )}
                    {activity.type === 'complete' && (
                      <div style={{
                        color: activity.success ? '#66BB6A' : '#EF5350',
                        fontWeight: 'bold',
                        marginTop: '8px',
                      }}>
                        {activity.success ? '✓' : '✗'} {activity.message}
                      </div>
                    )}
                    {activity.type === 'error' && (
                      <div style={{ color: '#EF5350' }}>
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
                backgroundColor: '#3a1e1e',
                borderRadius: '8px',
                borderLeft: '3px solid #EF5350',
                color: '#EF5350',
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
          onKeyPress={handleKeyPress}
          placeholder="Describe your Minecraft structure..."
          disabled={isLoading || !sessionId}
          style={{
            flex: 1,
            padding: '12px',
            backgroundColor: '#2d2d2d',
            border: '1px solid #444',
            borderRadius: '8px',
            color: '#e0e0e0',
            fontSize: '14px',
          }}
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !sessionId || !input.trim()}
          style={{
            padding: '12px 24px',
            backgroundColor: isLoading || !sessionId || !input.trim() ? '#555' : '#4CAF50',
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
