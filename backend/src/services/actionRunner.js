import { allActions } from './actionDefinitions.js';
import { callGopay, readUsableSessionToken, requestAccessToken, saveTokenToSession, tokenInfoFromSession } from './gopayClient.js';
import { addHistory, getLastPaymentId, setLastPaymentId } from './historyStore.js';
import { countFields, humanBytes, withoutMetaFields } from '../utils/json.js';
import { extractPaymentId, resolveUrl } from '../utils/urls.js';

function resolveEndpoint(endpoint, cfg, payload = {}) {
  return endpoint
    .replace('{id}', encodeURIComponent(String(payload.id || '')))
    .replace('{card_id}', encodeURIComponent(String(payload.card_id || '')))
    .replace('{goid}', encodeURIComponent(String(payload.goid || cfg.goid || '')))
    .replace('{currency}', encodeURIComponent(String(payload.currency || cfg.currency || '')));
}

function payloadSummary(payload, hasBody) {
  if (!hasBody) {
    return { status: 'No body', size: '0 B', fields: '0', hasReturnUrl: false, hasNotificationUrl: false };
  }

  const body = JSON.stringify(withoutMetaFields(payload || {}));
  return {
    status: 'Valid JSON',
    size: humanBytes(Buffer.byteLength(body)),
    fields: String(countFields(payload)),
    hasReturnUrl: Boolean(payload?.callback?.return_url),
    hasNotificationUrl: Boolean(payload?.callback?.notification_url),
  };
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function curl(action, url, payload) {
  if (action.tokenAction) {
    const scope = payload?.scope || 'payment-all';

    return [
      `curl --request POST ${shellQuote(url)} \\`,
      `  --header ${shellQuote('Accept: application/json')} \\`,
      `  --header ${shellQuote('Content-Type: application/x-www-form-urlencoded')} \\`,
      `  --user ${shellQuote('<client-id>:<client-secret>')} \\`,
      `  --data ${shellQuote(`grant_type=client_credentials&scope=${encodeURIComponent(scope)}`)}`,
    ].join('\n');
  }

  const lines = [
    `curl --request ${action.method} ${shellQuote(url)} \\`,
    `  --header ${shellQuote('Accept: application/json')} \\`,
    `  --header ${shellQuote('Authorization: Bearer <access-token>')}`,
  ];

  if (!['GET', 'DELETE'].includes(action.method)) {
    lines[lines.length - 1] += ' \\';
    lines.push(`  --header ${shellQuote('Content-Type: application/json')} \\`);

    const formattedPayload = JSON.stringify(withoutMetaFields(payload || {}), null, 2);
    lines.push(`  --data ${shellQuote(formattedPayload)}`);
  }

  return lines.join('\n');
}

function requestPreview(cfg, action, resolvedEndpoint, url, payload) {
  const hasBody = !['GET', 'DELETE'].includes(action.method) && !action.tokenAction;
  const summary = payloadSummary(payload, hasBody);
  const rows = [
    ['Environment', `${String(cfg.environment).toUpperCase()}${cfg.environment === 'custom' ? ` / ${String(cfg.mode).toUpperCase()}` : ''}`],
    ['Method', action.tokenAction ? 'POST' : action.method],
    ['URL', url],
    ['Endpoint', resolvedEndpoint],
    ['GoID', cfg.goid || 'not-set'],
    ['Auth', action.tokenAction ? 'Basic <client-id>:<client-secret>' : 'Bearer <access-token>'],
  ];

  if (action.tokenAction) {
    rows.push(['Token scope', payload?.scope || 'payment-all']);
    rows.push(['Body', 'grant_type=client_credentials']);
  } else if (hasBody) {
    rows.push(['Body', `${summary.size}, ${summary.fields} fields`]);
    rows.push(['Return URL', summary.hasReturnUrl ? 'yes' : 'no']);
    rows.push(['Notification URL', summary.hasNotificationUrl ? 'yes' : 'no']);
  } else {
    rows.push(['Body', 'not used']);
  }

  return rows.map(([key, value]) => `${key.padEnd(16)} ${value}`).join('\n');
}

export function prefillPayload(action, query = {}, req) {
  const payload = structuredClone(action.defaultPayload || {});
  const id = query.id || query.payment_id || query.paymentId || (action.needsPaymentId ? getLastPaymentId(req) : '');

  if (id && Object.prototype.hasOwnProperty.call(payload, 'id')) payload.id = String(id);
  if (query.card_id && Object.prototype.hasOwnProperty.call(payload, 'card_id')) payload.card_id = String(query.card_id);

  return payload;
}

export function prepareRequest(cfg, action, payload) {
  const resolvedEndpoint = resolveEndpoint(action.endpoint, cfg, payload);
  const url = resolveUrl(cfg.gatewayUrl, resolvedEndpoint);
  const body = action.tokenAction || ['GET', 'DELETE'].includes(action.method) ? null : withoutMetaFields(payload || {});

  return {
    method: action.tokenAction ? 'POST' : action.method,
    endpoint: resolvedEndpoint,
    url,
    host: new URL(url).host,
    headers: action.tokenAction ? {
      Authorization: 'Basic <client-id>:<client-secret>',
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    } : {
      Authorization: 'Bearer <access-token>',
      Accept: 'application/json',
      'Content-Type': action.method === 'GET' ? 'application/x-www-form-urlencoded' : 'application/json',
    },
    body,
    payloadSummary: payloadSummary(payload, body !== null),
    http: requestPreview(cfg, action, resolvedEndpoint, url, payload),
    curl: curl(action, url, payload),
  };
}

export async function executeAction(req, cfg, actionKey, payload, options = {}) {
  const actions = allActions(cfg);
  const action = actions[actionKey];
  if (!action) throw new Error(`Unknown action: ${actionKey}`);

  const prepared = prepareRequest(cfg, action, payload);
  const started = performance.now();


  try {
    if (action.tokenAction) {
      const tokenResult = await requestAccessToken(cfg, payload.scope || 'payment-all', { force: true });
      saveTokenToSession(req, tokenResult);
      const durationMs = Math.round(performance.now() - started);
      const result = {
        time: new Date().toISOString(),
        action: action.key,
        label: action.label,
        success: true,
        statusCode: 200,
        durationMs,
        prepared,
        json: {
          access_token: tokenResult.accessToken,
          token_type: tokenResult.tokenType,
          expires_in: tokenResult.expiresInSeconds,
          expires_at: new Date(tokenResult.expiresAt).toISOString(),
          scope: tokenResult.scope,
          source: tokenResult.source,
        },
        rawBody: JSON.stringify(tokenResult.raw || {}, null, 2),
        paymentId: null,
        tokenInfo: tokenInfoFromSession(req),
        error: null,
      };
      addHistory(req, result);
      return result;
    }

    const savedToken = options.useSavedToken ? readUsableSessionToken(req) : null;
    const response = await callGopay(cfg, prepared, prepared.body, { token: savedToken });
    const durationMs = Math.round(performance.now() - started);
    const paymentId = extractPaymentId(response.json) || payload?.id || null;
    if (paymentId) setLastPaymentId(req, paymentId);

    const result = {
      time: new Date().toISOString(),
      action: action.key,
      label: action.label,
      success: response.success,
      statusCode: response.statusCode,
      durationMs,
      prepared,
      json: response.json,
      rawBody: response.rawBody,
      paymentId,
      tokenSource: response.tokenSource,
      tokenInfo: tokenInfoFromSession(req),
      error: response.success ? null : response.rawBody,
    };
    addHistory(req, result);
    return result;
  } catch (error) {
    const result = {
      time: new Date().toISOString(),
      action: action.key,
      label: action.label,
      success: false,
      statusCode: 0,
      durationMs: Math.round(performance.now() - started),
      prepared,
      json: null,
      rawBody: '',
      paymentId: null,
      tokenInfo: tokenInfoFromSession(req),
      error: error.message,
    };
    addHistory(req, result);
    return result;
  }
}
