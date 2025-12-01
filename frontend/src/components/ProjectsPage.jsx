import { useState, useEffect } from 'react';

export default function ProjectsPage({ onSelectSession, onCreateNew }) {
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/sessions')
      .then(res => res.json())
      .then(data => {
        setSessions(data.sessions || []);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Error fetching sessions:', err);
        setIsLoading(false);
      });
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#1e1e1e',
      color: '#e0e0e0',
      padding: '40px',
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ color: '#4CAF50', marginBottom: '10px' }}>
          Minecraft Builder
        </h1>
        <p style={{ color: '#888', marginBottom: '30px' }}>
          Create Minecraft structures using natural language
        </p>

        <button
          onClick={onCreateNew}
          style={{
            padding: '16px 32px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            marginBottom: '40px',
          }}
        >
          + New Project
        </button>

        <h2 style={{ color: '#888', fontSize: '14px', textTransform: 'uppercase', marginBottom: '15px' }}>
          Recent Projects
        </h2>

        {isLoading ? (
          <p style={{ color: '#666' }}>Loading...</p>
        ) : sessions.length === 0 ? (
          <p style={{ color: '#666' }}>No projects yet. Create one to get started!</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {sessions.map(session => (
              <div
                key={session.session_id}
                onClick={() => onSelectSession(session.session_id)}
                style={{
                  padding: '15px 20px',
                  backgroundColor: '#2d2d2d',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3a3a3a'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2d2d2d'}
              >
                <div>
                  <div style={{ fontFamily: 'monospace', fontSize: '13px', color: '#888' }}>
                    {session.session_id.slice(0, 8)}...
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                    {session.message_count} messages
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {session.has_structure && (
                    <span style={{
                      padding: '4px 8px',
                      backgroundColor: '#4CAF50',
                      borderRadius: '4px',
                      fontSize: '11px',
                      color: 'white',
                    }}>
                      Has Structure
                    </span>
                  )}
                  <span style={{ color: '#666' }}>→</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
