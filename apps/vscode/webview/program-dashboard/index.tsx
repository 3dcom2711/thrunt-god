import { render } from 'preact';
import '../shared/tokens.css';

// Placeholder -- Task 2 replaces this with the full Program Dashboard UI
function App() {
  return (
    <main style={{ padding: '24px 18px' }}>
      <p>Program Dashboard loading...</p>
    </main>
  );
}

const root = document.getElementById('root');
if (root) {
  render(<App />, root);
}
