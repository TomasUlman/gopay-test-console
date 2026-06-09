import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const explicitEnvPath = process.env.DOTENV_CONFIG_PATH;

if (explicitEnvPath) {
  dotenv.config({ path: explicitEnvPath });
} else {
  // npm workspaces spousti backend s cwd = backend/, ale .env je v rootu projektu.
  // Proto zkusime obe mista. Prvni nalezena hodnota zustava platna.
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
  dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
}

function read(key, fallback = '') {
  const value = process.env[key];
  return value === undefined || value === '' ? fallback : value;
}

function bool(key, fallback = false) {
  const value = read(key, String(fallback));
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function isLocalUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local');
  } catch {
    return false;
  }
}

function notificationWarning(enabled, url, usable) {
  if (!enabled) {
    return 'HTTP notifications and inline gateway are not available on localhost because the app is not running on a public HTTPS origin.';
  }

  if (!url) return 'Notification URL is enabled, but no URL is configured.';
  if (!usable) return 'Configured notification URL looks local. GoPay cannot reach localhost from the internet.';
  return '';
}

function commonConfig() {
  const notificationUrl = read('GOPAY_DEFAULT_NOTIFICATION_URL', '');
  const notificationEnabled = bool('GOPAY_ENABLE_NOTIFICATION_URL', false);
  const notificationUsable = notificationEnabled && notificationUrl !== '' && !isLocalUrl(notificationUrl);

  return {
    currency: read('GOPAY_DEFAULT_CURRENCY', 'CZK'),
    lang: read('GOPAY_DEFAULT_LANG', 'CS'),
    returnUrl: read('GOPAY_DEFAULT_RETURN_URL', 'http://localhost:5173/?returned=1'),
    notificationUrl,
    notificationEnabled,
    notificationUsable,
    notificationWarning: notificationWarning(notificationEnabled, notificationUrl, notificationUsable),
    autoStatusCheck: bool('APP_AUTO_STATUS_CHECK', true),
  };
}

export function activeEnvironment() {
  const env = read('GOPAY_ACTIVE_ENV', 'sandbox').toLowerCase();
  return ['sandbox', 'production', 'custom'].includes(env) ? env : 'sandbox';
}

export function customState(req) {
  const state = req.session?.customGopay || {};
  const mode = ['sandbox', 'production'].includes(String(state.mode).toLowerCase()) ? String(state.mode).toLowerCase() : 'sandbox';
  return {
    mode,
    goid: state.goid || '',
    clientId: state.clientId || '',
    clientSecret: state.clientSecret || '',
  };
}

export function saveCustomState(req, input = {}) {
  const mode = ['sandbox', 'production'].includes(String(input.mode).toLowerCase()) ? String(input.mode).toLowerCase() : 'sandbox';
  req.session.customGopay = {
    mode,
    goid: String(input.goid || '').trim(),
    clientId: String(input.clientId || '').trim(),
    clientSecret: String(input.clientSecret || '').trim(),
  };
}

export function gopayConfig(req, environment = activeEnvironment()) {
  const env = ['sandbox', 'production', 'custom'].includes(environment) ? environment : 'sandbox';
  const base = commonConfig();

  if (env === 'custom') {
    const custom = customState(req);
    const gatewayUrl = custom.mode === 'production'
      ? read('GOPAY_PRODUCTION_GATEWAY_URL', 'https://gate.gopay.cz/api')
      : read('GOPAY_SANDBOX_GATEWAY_URL', 'https://gw.sandbox.gopay.com/api');

    return {
      ...base,
      environment: 'custom',
      mode: custom.mode,
      goid: custom.goid,
      clientId: custom.clientId,
      clientSecret: custom.clientSecret,
      gatewayUrl: gatewayUrl.replace(/\/$/, ''),
      isCustom: true,
    };
  }

  const prefix = `GOPAY_${env.toUpperCase()}_`;
  return {
    ...base,
    environment: env,
    mode: env,
    goid: read(`${prefix}GOID`, ''),
    clientId: read(`${prefix}CLIENT_ID`, ''),
    clientSecret: read(`${prefix}CLIENT_SECRET`, ''),
    gatewayUrl: read(`${prefix}GATEWAY_URL`, env === 'production' ? 'https://gate.gopay.cz/api' : 'https://gw.sandbox.gopay.com/api').replace(/\/$/, ''),
    isCustom: false,
  };
}

function mask(value) {
  if (!value) return 'not-set';
  return `${value.slice(0, 4)}${'*'.repeat(Math.max(4, value.length - 4))}`;
}

export function maskedConfig(cfg) {
  return {
    ...cfg,
    clientId: mask(cfg.clientId),
    clientSecret: mask(cfg.clientSecret),
  };
}

export const serverConfig = {
  port: Number(read('PORT', '3001')),
  sessionSecret: read('SESSION_SECRET', 'local-dev-only-change-me'),
  corsOrigin: read('CORS_ORIGIN', 'http://localhost:5173'),
};
