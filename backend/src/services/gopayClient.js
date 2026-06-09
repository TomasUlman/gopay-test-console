import { resolveUrl } from '../utils/urls.js';

const tokenCache = new Map();

function cacheKey(cfg, scope) {
  return `${cfg.gatewayUrl}|${cfg.clientId}|${scope}`;
}

async function readBody(response) {
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();

  if (contentType.includes('application/json')) {
    try { return { json: JSON.parse(text), rawBody: text }; } catch { /* noop */ }
  }

  try { return { json: JSON.parse(text), rawBody: text }; } catch { return { json: null, rawBody: text }; }
}

export function tokenInfoFromSession(req) {
  const token = req.session?.gopayToken;
  if (!token?.accessToken || !token?.expiresAt) {
    return { available: false, expiresAt: null, expiresInSeconds: 0, scope: '', tokenPreview: 'none' };
  }

  const expiresInSeconds = Math.max(0, Math.floor((Number(token.expiresAt) - Date.now()) / 1000));
  return {
    available: expiresInSeconds > 0,
    expiresAt: new Date(Number(token.expiresAt)).toISOString(),
    expiresInSeconds,
    scope: token.scope || 'payment-all',
    tokenPreview: `${String(token.accessToken).slice(0, 10)}...${String(token.accessToken).slice(-6)}`,
  };
}

export function saveTokenToSession(req, tokenResult) {
  req.session.gopayToken = {
    accessToken: tokenResult.accessToken,
    tokenType: tokenResult.tokenType,
    scope: tokenResult.scope,
    expiresAt: tokenResult.expiresAt,
    createdAt: Date.now(),
  };
}

export function readUsableSessionToken(req) {
  const token = req.session?.gopayToken;
  if (!token?.accessToken || Number(token.expiresAt) <= Date.now() + 5000) return null;
  return token.accessToken;
}

export async function requestAccessToken(cfg, scope = 'payment-all', options = {}) {
  if (!cfg.clientId || !cfg.clientSecret) {
    throw new Error('Missing GoPay Client ID or Client Secret. Fill .env or custom credentials.');
  }

  const key = cacheKey(cfg, scope);
  const cached = tokenCache.get(key);
  if (!options.force && cached && cached.expiresAt > Date.now() + 30_000) {
    return {
      accessToken: cached.token,
      tokenType: cached.tokenType || 'Bearer',
      expiresAt: cached.expiresAt,
      expiresInSeconds: Math.max(0, Math.floor((cached.expiresAt - Date.now()) / 1000)),
      scope,
      source: 'cache',
      raw: cached.raw || null,
    };
  }

  const credentials = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`, 'utf8').toString('base64');
  const response = await fetch(resolveUrl(cfg.gatewayUrl, '/api/oauth2/token'), {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope }),
  });

  const body = await readBody(response);
  if (!response.ok || !body.json?.access_token) {
    const message = body.json?.error_description || body.json?.error || body.rawBody || `Token request failed with HTTP ${response.status}`;
    throw new Error(message);
  }

  const expiresIn = Number(body.json.expires_in || 1800);
  const token = body.json.access_token;
  const tokenType = body.json.token_type || 'Bearer';
  const expiresAt = Date.now() + expiresIn * 1000;

  tokenCache.set(key, { token, tokenType, expiresAt, raw: body.json });
  return {
    accessToken: token,
    tokenType,
    expiresAt,
    expiresInSeconds: expiresIn,
    scope,
    source: 'api',
    raw: body.json,
  };
}

export async function getAccessToken(cfg, scope = 'payment-all') {
  const result = await requestAccessToken(cfg, scope);
  return result.accessToken;
}

export async function callGopay(cfg, prepared, body, options = {}) {
  const token = options.token || await getAccessToken(cfg, 'payment-all');
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };

  const init = { method: prepared.method, headers };
  if (!['GET', 'DELETE'].includes(prepared.method)) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body ?? {});
  }

  const response = await fetch(prepared.url, init);
  const parsed = await readBody(response);
  return {
    success: response.ok,
    statusCode: response.status,
    json: parsed.json,
    rawBody: parsed.rawBody,
    contentType: response.headers.get('content-type') || '',
    tokenSource: options.token ? 'saved-token' : 'auto-token',
  };
}
