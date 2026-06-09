function basePayment(cfg) {
  const goid = Number(cfg.goid || 8123456789);
  const currency = cfg.currency || 'CZK';
  const lang = cfg.lang || 'CS';
  const order = `LOCAL-${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}`;

  return {
    payer: {
      allowed_payment_instruments: ['PAYMENT_CARD', 'BANK_ACCOUNT'],
      default_payment_instrument: 'PAYMENT_CARD',
      contact: {
        first_name: 'Test',
        last_name: 'User',
        email: 'test@example.com',
        phone_number: '+420777456123',
        city: 'Prague',
        street: 'Test Street 1',
        postal_code: '11000',
        country_code: 'CZE',
      },
    },
    target: {
      type: 'ACCOUNT',
      goid,
    },
    items: [{
      type: 'ITEM',
      name: 'Test item',
      amount: 100,
      count: 1,
      vat_rate: '21',
    }],
    amount: 100,
    currency,
    order_number: order,
    order_description: 'Local GoPay Test Console test',
    lang,
    callback: Object.fromEntries(Object.entries({
      return_url: cfg.returnUrl,
      notification_url: cfg.notificationUsable ? cfg.notificationUrl : null,
    }).filter(([, value]) => value)),
    additional_params: [{ name: 'source', value: 'gopay-test-console' }],
  };
}

function def(key, group, label, description, method, endpoint, defaultPayload = {}, requiredFields = [], options = {}) {
  return {
    key,
    group,
    label,
    description,
    method,
    endpoint,
    defaultPayload,
    requiredFields,
    needsPaymentId: Boolean(options.needsPaymentId),
    needsCardId: Boolean(options.needsCardId),
    danger: Boolean(options.danger),
    tokenAction: Boolean(options.tokenAction),
  };
}

export function allActions(cfg) {
  const base = basePayment(cfg);
  const goid = Number(cfg.goid || 8123456789);
  const currency = cfg.currency || 'CZK';
  const today = new Date().toISOString().slice(0, 10);
  const plusYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const minusWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);

  const actions = [
    def('oauth_token', 'Auth', 'Get OAuth token', 'Gets access token and stores it for test calls.', 'POST', '/api/oauth2/token', { scope: 'payment-all' }, ['scope'], { tokenAction: true }),

    def('create_payment', 'Payments', 'Create payment', 'Creates standard payment.', 'POST', '/api/payments/payment', base, ['amount', 'currency', 'order_number', 'callback.return_url']),
    def('payment_status', 'Payments', 'Payment status', 'Loads payment status by ID.', 'GET', '/api/payments/payment/{id}', { id: '' }, ['id'], { needsPaymentId: true }),
    def('payment_refund', 'Payments', 'Refund payment', 'Refunds payment amount.', 'POST', '/api/payments/payment/{id}/refund', { id: '', amount: 100 }, ['id', 'amount'], { needsPaymentId: true, danger: true }),

    def('create_preauth', 'Preauthorized payments', 'Create preauth', 'Blocks card funds.', 'POST', '/api/payments/payment', { ...base, preauthorization: true }, ['amount', 'currency', 'preauthorization', 'callback.return_url']),
    def('capture_preauth', 'Preauthorized payments', 'Capture preauth', 'Captures blocked funds.', 'POST', '/api/payments/payment/{id}/capture', { id: '' }, ['id'], { needsPaymentId: true }),
    def('capture_preauth_partial', 'Preauthorized payments', 'Partial capture', 'Captures lower amount.', 'POST', '/api/payments/payment/{id}/capture', { id: '', amount: 100, items: [{ type: 'ITEM', name: 'Partial item', amount: 100, count: 1 }] }, ['id', 'amount'], { needsPaymentId: true }),
    def('void_preauth', 'Preauthorized payments', 'Void preauth', 'Cancels blocked funds.', 'POST', '/api/payments/payment/{id}/void-authorization', { id: '' }, ['id'], { needsPaymentId: true, danger: true }),

    def('create_recurrence_init', 'Recurring payments', 'Create recurrence', 'Creates initial recurrence.', 'POST', '/api/payments/payment', { ...base, recurrence: { recurrence_cycle: 'ON_DEMAND', recurrence_date_to: plusYear } }, ['amount', 'currency', 'recurrence', 'callback.return_url']),
    def('create_recurrence_on_demand', 'Recurring payments', 'On-demand recurrence', 'Creates next recurrence.', 'POST', '/api/payments/payment/{id}/create-recurrence', { id: '', amount: 100, currency, order_number: `REC-${stamp}`, order_description: 'ON_DEMAND recurrence test' }, ['id', 'amount', 'currency', 'order_number'], { needsPaymentId: true }),
    def('void_recurrence', 'Recurring payments', 'Void recurrence', 'Cancels recurrence.', 'POST', '/api/payments/payment/{id}/void-recurrence', { id: '' }, ['id'], { needsPaymentId: true, danger: true }),

    def('payment_methods_currency', 'Payment methods', 'Methods by currency', 'Allowed methods for currency.', 'GET', '/api/eshops/eshop/{goid}/payment-instruments/{currency}', { goid, currency }, ['goid', 'currency']),
    def('payment_methods_all', 'Payment methods', 'All methods', 'Allowed methods for GoID.', 'GET', '/api/eshops/eshop/{goid}/payment-instruments', { goid }, ['goid']),

    def('card_details', 'Saved cards', 'Card details', 'Loads saved card.', 'GET', '/api/payment-cards/{card_id}', { card_id: '' }, ['card_id'], { needsCardId: true }),
    def('delete_card', 'Saved cards', 'Delete card', 'Deletes saved card token.', 'DELETE', '/api/payment-cards/{card_id}', { card_id: '' }, ['card_id'], { needsCardId: true, danger: true }),

    def('account_statement', 'Merchant account', 'Account statement', 'Generates account CSV.', 'POST', '/api/accounts/account-statement', { date_from: minusWeek, date_to: today, goid, currency, format: 'CSV_A' }, ['date_from', 'date_to', 'goid', 'currency', 'format']),
  ];

  return Object.fromEntries(actions.map((action) => [action.key, action]));
}

export function scenarios(cfg, actions) {
  const base = actions.create_payment.defaultPayload;
  const suffix = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const plusYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const cardOnly = (payload) => ({
    ...payload,
    payer: {
      ...payload.payer,
      allowed_payment_instruments: ['PAYMENT_CARD'],
      default_payment_instrument: 'PAYMENT_CARD',
    },
  });

  const freeTrial = cardOnly(structuredClone(base));
  freeTrial.amount = 0;
  freeTrial.items[0].amount = 0;
  freeTrial.order_number = `FREE-TRIAL-${suffix}`;
  freeTrial.order_description = 'Free trial card verification';
  freeTrial.preauthorization = true;
  freeTrial.recurrence = { recurrence_cycle: 'ON_DEMAND', recurrence_date_to: plusYear };

  const cardToken = cardOnly(structuredClone(base));
  cardToken.amount = 100;
  cardToken.items[0].amount = 100;
  cardToken.order_number = `CARD-TOKEN-${suffix}`;
  cardToken.order_description = 'Request card token test';
  cardToken.payer.request_card_token = true;

  const monthly = cardOnly(structuredClone(base));
  monthly.amount = 100;
  monthly.items[0].amount = 100;
  monthly.order_number = `MONTHLY-SUB-${suffix}`;
  monthly.order_description = 'Automatic monthly recurring payment test';
  monthly.recurrence = { recurrence_cycle: 'MONTH', recurrence_period: 1, recurrence_date_to: plusYear };

  return {
    free_trial_card_verification: { label: 'Free trial card verification', description: 'Zero amount card verification.', action: 'create_recurrence_init', payload: freeTrial },
    request_card_token: { label: 'Request card token', description: 'Requests card token.', action: 'create_payment', payload: cardToken },
    monthly_subscription: { label: 'Monthly subscription', description: 'Monthly recurring setup.', action: 'create_recurrence_init', payload: monthly },
  };
}
