const MAX_HISTORY = 25;

export function getHistory(req) {
  return req.session.history || [];
}

export function addHistory(req, result) {
  const item = {
    time: result.time,
    action: result.action,
    label: result.label,
    success: result.success,
    statusCode: result.statusCode,
    durationMs: result.durationMs,
    paymentId: result.paymentId || null,
  };

  req.session.history = [item, ...(req.session.history || [])].slice(0, MAX_HISTORY);
}

export function clearHistory(req) {
  req.session.history = [];
}

export function getLastPaymentId(req) {
  return req.session.lastPaymentId || '';
}

export function setLastPaymentId(req, id) {
  if (id) req.session.lastPaymentId = String(id);
}
