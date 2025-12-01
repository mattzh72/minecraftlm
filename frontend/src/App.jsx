import useSession from './hooks/useSession';
import useSessionStore from './store/sessionStore';
import ChatPanel from './components/ChatPanel';
import MinecraftViewer from './components/MinecraftViewer';
import './App.css';

function App() {
  const { sessionId, isCreatingSession } = useSession();
  const structureData = useSessionStore((state) => state.structureData);

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      backgroundColor: '#1a1a1a',
      color: '#e0e0e0',
      overflow: 'hidden',
    }}>
      <div style={{
        width: '400px',
        borderRight: '1px solid #333',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <ChatPanel />
      </div>

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0a0a0a',
      }}>
        {structureData ? (
          <MinecraftViewer />
        ) : (
          <div style={{
            textAlign: 'center',
            color: '#666',
          }}>
            <h2>Minecraft Schematic Generator</h2>
            <p>
              {isCreatingSession
                ? 'Creating session...'
                : sessionId
                  ? 'Start chatting to design your Minecraft structure!'
                  : 'Session initialization failed'}
            </p>
            <p style={{ fontSize: '0.9em', marginTop: '20px' }}>
              Controls:<br />
              • Mouse drag: Rotate view<br />
              • Scroll: Zoom in/out<br />
              • WASD: Move camera<br />
              • Shift/Space: Move up/down
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
