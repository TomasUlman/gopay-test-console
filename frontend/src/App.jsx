import { useEffect, useMemo, useState } from 'react';
import { TerminalPage } from './features/terminal/TerminalPage.jsx';
import { api } from './features/terminal/terminalApi.js';

export default function App() {
  const query = useMemo(() => new URLSearchParams(window.location.search), []);
  const [state, setState] = useState(null);
  const [toast, setToast] = useState(null);

  async function load(environment, action) {
    const data = await api.state({
      environment,
      action,
      id: query.get('id') || query.get('payment_id') || query.get('paymentId') || '',
    });
    setState(data);
  }

  useEffect(() => {
    load(query.get('environment') || undefined, query.get('action') || undefined).catch((error) => {
      setToast({ type: 'error', message: error.message });
    });
  }, []);

  if (!state) {
    return (
      <main className="min-h-screen bg-terminal-bg p-10 text-terminal-text">
        <div className="panel max-w-3xl">Loading GoPay Test Console...</div>
      </main>
    );
  }

  return <TerminalPage state={state} setState={setState} reload={load} toast={toast} setToast={setToast} />;
}
