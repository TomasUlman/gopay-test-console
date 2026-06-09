import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Clock3, Copy, ExternalLink, KeyRound, RadioTower, Trash2 } from 'lucide-react';
import { Toast } from '../../ui/Toast.jsx';
import { groupActions, pretty } from '../../utils/format.js';
import { api } from './terminalApi.js';

function copy(text, setToast) {
  navigator.clipboard.writeText(String(text || '').trim())
    .then(() => setToast({ type: 'success', message: 'Copied to clipboard.' }))
    .catch(() => setToast({ type: 'error', message: 'Copy failed. Select the text manually.' }));
}

function formatSeconds(seconds) {
  const safe = Math.max(0, Number(seconds || 0));
  const min = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function TerminalPage({ state, setState, toast, setToast }) {
  const [environment, setEnvironment] = useState(state.cfg.environment);
  const [selectedAction, setSelectedAction] = useState(state.selectedAction);
  const [payloadText, setPayloadText] = useState(pretty(state.payload));
  const [useSavedToken, setUseSavedToken] = useState(false);
  const [result, setResult] = useState(null);
  const [sending, setSending] = useState(false);
  const [custom, setCustom] = useState({ mode: 'sandbox', goid: '', clientId: '', clientSecret: '' });
  const [tokenInfo, setTokenInfo] = useState(state.tokenInfo);
  const [tokenSecondsLeft, setTokenSecondsLeft] = useState(state.tokenInfo?.expiresInSeconds || 0);
  const autoStatusDone = useRef(false);
  const responseRef = useRef(null);

  const actionsByGroup = useMemo(() => groupActions(state.actions), [state.actions]);
  const action = state.actions[selectedAction] || state.actions.create_payment;

  useEffect(() => {
    setTokenInfo(state.tokenInfo);
    setTokenSecondsLeft(state.tokenInfo?.expiresInSeconds || 0);
  }, [state.tokenInfo]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setTokenSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!result) return;
    window.setTimeout(() => {
      responseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }, [result]);

  useEffect(() => {
    const returnedId = state.returnedPaymentId;
    if (!returnedId || autoStatusDone.current || !state.cfg.autoStatusCheck) return;
    autoStatusDone.current = true;

    async function loadReturnedPaymentStatus() {
      setSelectedAction('payment_status');
      setPayloadText(pretty({ id: String(returnedId) }));
      setSending(true);
      setToast({ type: 'info', message: `Returned from gateway. Loading payment ${returnedId}...` });
      try {
        const response = await api.execute({
          environment,
          action: 'payment_status',
          payload: { id: String(returnedId) },
          useSavedToken,
        });
        setResult(response);
        setTokenInfo(response.tokenInfo);
        setTokenSecondsLeft(response.tokenInfo?.expiresInSeconds || 0);
        setState((current) => ({
          ...current,
          history: response.history,
          lastPaymentId: response.lastPaymentId,
          tokenInfo: response.tokenInfo,
        }));
        setToast({ type: response.success ? 'success' : 'error', message: response.success ? 'Payment status loaded.' : 'Payment status failed.' });
      } finally {
        setSending(false);
      }
    }

    loadReturnedPaymentStatus().catch((error) => {
      setSending(false);
      setToast({ type: 'error', message: error.message });
    });
  }, [environment, setState, setToast, state, useSavedToken]);

  async function changeEnvironment(nextEnvironment) {
    setEnvironment(nextEnvironment);
    const next = await api.state({ environment: nextEnvironment, action: selectedAction });
    setState(next);
    setPayloadText(pretty(next.payload));
    setTokenInfo(next.tokenInfo);
    setTokenSecondsLeft(next.tokenInfo?.expiresInSeconds || 0);
    setToast({ type: 'info', message: `Environment switched to ${nextEnvironment}.` });
  }

  async function changeAction(actionKey) {
    setSelectedAction(actionKey);
    const next = await api.state({ environment, action: actionKey });
    setState(next);
    setPayloadText(pretty(next.payload));
    setResult(null);
    setTokenInfo(next.tokenInfo);
    setTokenSecondsLeft(next.tokenInfo?.expiresInSeconds || 0);
  }

  function loadScenario(scenario) {
    setSelectedAction(scenario.action);
    setPayloadText(pretty(scenario.payload));
    setToast({ type: 'success', message: `Scenario loaded: ${scenario.label}` });
  }

  async function saveCustomEnv(event) {
    event.preventDefault();
    const response = await api.saveCustomEnv(custom);
    setToast({ type: response.ok ? 'success' : 'error', message: response.ok ? 'Custom environment saved for this session.' : 'Custom environment save failed.' });
    if (environment === 'custom') await changeEnvironment('custom');
  }

  async function execute(event) {
    event.preventDefault();
    let payload;
    try {
      payload = JSON.parse(payloadText || '{}');
    } catch (error) {
      setToast({ type: 'error', message: `Invalid JSON: ${error.message}` });
      return;
    }

    if (action.danger && !window.confirm('This action can modify payment data. Continue?')) return;

    setSending(true);
    setToast({ type: 'info', message: action.tokenAction ? 'Requesting OAuth token...' : 'Request transmitted...' });
    try {
      const response = await api.execute({ environment, action: selectedAction, payload, useSavedToken });
      setResult(response);
      setTokenInfo(response.tokenInfo);
      setTokenSecondsLeft(response.tokenInfo?.expiresInSeconds || 0);
      setState((current) => ({
        ...current,
        history: response.history,
        lastPaymentId: response.lastPaymentId,
        tokenInfo: response.tokenInfo,
      }));
      setToast({ type: response.success ? 'success' : 'error', message: response.success ? 'Response received successfully.' : 'Response received with an error.' });
    } finally {
      setSending(false);
    }
  }

  async function clearHistory() {
    const response = await api.clearHistory();
    setState((current) => ({ ...current, history: response.history }));
    setToast({ type: 'success', message: 'Session history cleared.' });
  }

  function formatPayload() {
    try {
      setPayloadText(JSON.stringify(JSON.parse(payloadText), null, 2));
      setToast({ type: 'success', message: 'JSON formatted.' });
    } catch (error) {
      setToast({ type: 'error', message: `Invalid JSON: ${error.message}` });
    }
  }

  const prepared = result?.prepared || state.prepared;
  const tokenAvailable = Boolean(tokenInfo?.available && tokenSecondsLeft > 0);

  return (
    <div className="min-h-screen text-terminal-text">
      <div className="stars" />
      <Toast toast={toast} onClose={() => setToast(null)} />

      <header className="topbar">
        <div>
          <div className="eyebrow">LOCAL TESTING HUB</div>
          <h1>GoPay Test Console</h1>
        </div>
        <label className="env-switch">
          <span>Environment</span>
          <select value={environment} onChange={(event) => changeEnvironment(event.target.value)}>
            <option value="sandbox">sandbox</option>
            <option value="production">production</option>
            <option value="custom">custom</option>
          </select>
        </label>
      </header>

      <section className={`status-strip ${environment === 'production' ? 'danger-zone' : ''}`}>
        <div><span>Mode</span><strong>{state.cfg.environment}{state.cfg.environment === 'custom' ? ` / ${state.cfg.mode}` : ''}</strong></div>
        <div><span>GoID</span><strong>{state.cfg.goid || 'not-set'}</strong></div>
        <div><span>Client ID</span><strong>{state.cfg.clientId}</strong></div>
        <div><span>Secret</span><strong>{state.cfg.clientSecret}</strong></div>
        <div><span>Gateway</span><strong>{state.cfg.gatewayUrl}</strong></div>
        <div><span>Last payment</span><strong>{state.lastPaymentId || 'none'}</strong></div>
      </section>

      {environment === 'custom' && (
        <section className="custom-env-panel panel">
          <div className="panel-title">CUSTOM SESSION ENVIRONMENT</div>
          <form className="custom-grid" onSubmit={saveCustomEnv}>
            <label>Mode<select value={custom.mode} onChange={(e) => setCustom({ ...custom, mode: e.target.value })}><option value="sandbox">sandbox</option><option value="production">production</option></select></label>
            <label>GoID<input value={custom.goid} onChange={(e) => setCustom({ ...custom, goid: e.target.value })} placeholder="8123456789" /></label>
            <label>Client ID<input value={custom.clientId} onChange={(e) => setCustom({ ...custom, clientId: e.target.value })} /></label>
            <label>Client Secret<input type="password" value={custom.clientSecret} onChange={(e) => setCustom({ ...custom, clientSecret: e.target.value })} /></label>
            <button className="primary" type="submit">SAVE CUSTOM</button>
          </form>
        </section>
      )}

      <main className="layout">
        <aside className="panel action-panel">
          <div className="panel-title">API ACTIONS</div>
          <div className="actions-scroll">
            {Object.entries(actionsByGroup).map(([group, actions]) => (
              <div key={group}>
                <h3>{group}</h3>
                {actions.map((item) => (
                  <button
                    key={item.key}
                    className={`action ${selectedAction === item.key ? 'active' : ''} ${item.danger ? 'danger' : ''}`}
                    onClick={() => changeAction(item.key)}
                    type="button"
                  >
                    <span>{item.tokenAction ? 'AUTH' : item.method}</span>
                    <strong>{item.label}</strong>
                    {item.description ? <small>{item.description}</small> : null}
                  </button>
                ))}
              </div>
            ))}

            <div className="scenario-block">
              <h3>Scenarios</h3>
              {Object.values(state.scenarios).map((scenario) => (
                <button key={scenario.label} type="button" className="scenario-card" onClick={() => loadScenario(scenario)}>
                  <strong>{scenario.label}</strong>
                  {scenario.description ? <small>{scenario.description}</small> : null}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="panel editor-panel">
          <div className="panel-title">JSON PAYLOAD</div>
          <h2>{action.label}</h2>
          <div className="endpoint-line">
            <span className="method">{prepared.method}</span>
            <code>{prepared.endpoint}</code>
          </div>
          <form className="editor-form" onSubmit={execute}>
            <textarea id="payloadEditor" value={payloadText} onChange={(event) => setPayloadText(event.target.value)} spellCheck="false" />
            <div className="button-row">
              <button className="primary" data-send-request disabled={sending}>{sending ? 'TRANSMITTING...' : action.tokenAction ? 'GET TOKEN' : 'SEND REQUEST'}</button>
              <button type="button" onClick={formatPayload}>FORMAT JSON</button>
              <button type="button" onClick={() => copy(payloadText, setToast)}><Copy size={14} /> COPY PAYLOAD</button>
            </div>
          </form>
        </section>

        <section className="panel request-panel">
          <div className="panel-title">REQUEST PREVIEW</div>

          {tokenInfo?.available && (
            <div className={`token-box ${tokenAvailable ? 'token-box--ok' : ''}`}>
              <div><KeyRound size={15} /> Saved token</div>
              <strong>{tokenInfo.tokenPreview}</strong>
              <span><Clock3 size={14} /> {tokenAvailable ? formatSeconds(tokenSecondsLeft) : 'expired'}</span>
              <label className="inline-check"><input type="checkbox" checked={useSavedToken} onChange={(e) => setUseSavedToken(e.target.checked)} disabled={!tokenAvailable} /> Use saved token for API calls</label>
            </div>
          )}

          <div className="request-facts">
            <div>
              <span>Method</span>
              <strong>{prepared.method}</strong>
            </div>
            <div>
              <span>Environment</span>
              <strong>{state.cfg.environment}{state.cfg.environment === 'custom' ? ` / ${state.cfg.mode}` : ''}</strong>
            </div>
            <div className="request-facts__wide">
              <span>Endpoint</span>
              <code>{prepared.endpoint}</code>
            </div>
            <div className="request-facts__wide">
              <span>Auth</span>
              <strong>{useSavedToken && tokenAvailable ? 'saved token' : action.tokenAction ? 'basic credentials' : 'auto token'}</strong>
            </div>
          </div>

          <h3>cURL preview</h3>
          <pre id="curlPreview" className="curl-preview">{prepared.curl}</pre>
          <div className="button-row compact curl-actions">
            <button type="button" onClick={() => copy(prepared.curl, setToast)}><Copy size={14} /> COPY CURL</button>
          </div>
        </section>
      </main>

      <section className="bottom-grid" ref={responseRef}>
        <div className={`panel response-panel ${result ? (result.success ? 'success' : 'error') : ''}`}>
          <div className="response-head">
            <RadioTower size={16} />
            <strong>RESPONSE</strong>
            {result && <span>HTTP {result.statusCode || 'ERR'} / {result.durationMs} ms</span>}
            {result?.tokenSource && <span>{result.tokenSource}</span>}
          </div>
          {!result ? <div className="empty">No response yet. Send a request from the JSON editor.</div> : (
            <>
              {result.error && <div className="error-text">{result.error}</div>}
              {result.json?.gw_url && <a className="button primary" href={result.json.gw_url} rel="noreferrer" referrerPolicy="no-referrer"><ExternalLink size={14} /> OPEN GATEWAY</a>}
              <pre>{pretty(result.json || result.rawBody)}</pre>
            </>
          )}
        </div>

        <div className="panel">
          <div className="response-head">
            <strong>SESSION HISTORY</strong>
            <button type="button" onClick={clearHistory}><Trash2 size={14} /> CLEAR</button>
          </div>
          {state.history?.length ? state.history.map((item, index) => (
            <div className={`history-item ${item.success ? 'ok' : 'fail'}`} key={`${item.time}-${index}`}>
              <span>{new Date(item.time).toLocaleTimeString()}</span>
              <div><strong>{item.label}</strong><br /><em>{item.paymentId ? `payment ${item.paymentId}` : item.action}</em></div>
              <strong>{item.statusCode || 'ERR'}</strong>
            </div>
          )) : <div className="empty">No session history yet.</div>}
        </div>
      </section>

      {state.cfg.notificationWarning && (
        <footer className="footer-warning">
          <AlertTriangle size={16} /> {state.cfg.notificationWarning}
        </footer>
      )}
    </div>
  );
}
