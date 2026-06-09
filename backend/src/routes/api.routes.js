import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { allActions, scenarios } from '../services/actionDefinitions.js';
import { clearHistory, getHistory, getLastPaymentId, setLastPaymentId } from '../services/historyStore.js';
import { executeAction, prefillPayload, prepareRequest } from '../services/actionRunner.js';
import { activeEnvironment, customState, gopayConfig, maskedConfig, saveCustomState } from '../config/env.js';
import { tokenInfoFromSession } from '../services/gopayClient.js';

export const apiRouter = express.Router();

function paymentIdFromQuery(query = {}) {
  return query.id || query.payment_id || query.paymentId || '';
}

function buildState(req, environment = activeEnvironment(), selectedAction = 'create_payment') {
  const returnedPaymentId = paymentIdFromQuery(req.query);
  if (returnedPaymentId) setLastPaymentId(req, returnedPaymentId);

  const cfg = gopayConfig(req, environment);
  const actions = allActions(cfg);
  const action = actions[selectedAction] || actions.create_payment;
  const payload = prefillPayload(action, req.query, req);
  const prepared = prepareRequest(cfg, action, payload);

  return {
    cfg: maskedConfig(cfg),
    custom: { ...customState(req), clientSecret: customState(req).clientSecret ? '********' : '' },
    actions,
    scenarios: scenarios(cfg, actions),
    selectedAction: action.key,
    payload,
    prepared,
    history: getHistory(req),
    lastPaymentId: getLastPaymentId(req),
    returnedPaymentId,
    tokenInfo: tokenInfoFromSession(req),
  };
}

apiRouter.get('/state', (req, res) => {
  res.json(buildState(req, req.query.environment || activeEnvironment(), req.query.action || 'create_payment'));
});

apiRouter.post('/custom-env', (req, res) => {
  saveCustomState(req, req.body || {});
  res.json({ ok: true, custom: { ...customState(req), clientSecret: customState(req).clientSecret ? '********' : '' } });
});

apiRouter.post('/execute', async (req, res) => {
  const environment = req.body.environment || activeEnvironment();
  const cfg = gopayConfig(req, environment);
  const payload = req.body.payload || {};
  const result = await executeAction(req, cfg, req.body.action, payload, {
    useSavedToken: Boolean(req.body.useSavedToken),
  });
  res.status(result.success ? 200 : result.statusCode && result.statusCode >= 400 ? result.statusCode : 500).json({
    ...result,
    history: getHistory(req),
    lastPaymentId: getLastPaymentId(req),
    tokenInfo: tokenInfoFromSession(req),
  });
});

apiRouter.post('/history/clear', (req, res) => {
  clearHistory(req);
  res.json({ ok: true, history: [] });
});

apiRouter.all('/notify', async (req, res) => {
  const entry = {
    time: new Date().toISOString(),
    method: req.method,
    query: req.query,
    headers: req.headers,
    body: req.body,
  };

  const incomingPaymentId = paymentIdFromQuery(req.query) || req.body?.id || req.body?.payment_id || req.body?.paymentId || '';
  if (incomingPaymentId) setLastPaymentId(req, incomingPaymentId);

  const file = path.resolve('storage', 'callbacks.jsonl');
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, `${JSON.stringify(entry)}\n`, 'utf8');

  res.json({ ok: true, message: 'Callback logged. Use payment status action to load actual state.', paymentId: incomingPaymentId || null, query: req.query });
});
