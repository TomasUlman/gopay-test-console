export function resolveUrl(gatewayUrl, endpoint) {
  const base = String(gatewayUrl || '').replace(/\/$/, '');
  if (base.endsWith('/api') && endpoint.startsWith('/api/')) {
    return `${base}${endpoint.slice(4)}`;
  }
  return `${base}/${endpoint.replace(/^\//, '')}`;
}

export function extractPaymentId(json) {
  if (!json || typeof json !== 'object') return null;
  if (json.id) return String(json.id);
  if (json.payment_id) return String(json.payment_id);
  return null;
}
