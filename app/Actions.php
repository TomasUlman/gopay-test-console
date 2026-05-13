<?php

namespace MissionTerminal;

final class Actions
{
    /** @return array<string, ActionDefinition> */
    public static function all(array $cfg): array
    {
        $goid = (int) ($cfg['goid'] ?: 8123456789);
        $currency = $cfg['currency'] ?: 'CZK';
        $lang = $cfg['lang'] ?: 'CS';
        $order = 'LOCAL-' . date('Ymd-His');

        $basePayment = [
            'payer' => [
                'allowed_payment_instruments' => ['PAYMENT_CARD', 'BANK_ACCOUNT'],
                'default_payment_instrument' => 'PAYMENT_CARD',
                'contact' => [
                    'first_name' => 'Test',
                    'last_name' => 'User',
                    'email' => 'test@example.com',
                    'phone_number' => '+420777456123',
                    'city' => 'Prague',
                    'street' => 'Test Street 1',
                    'postal_code' => '11000',
                    'country_code' => 'CZE'
                ]
            ],
            'target' => [
                'type' => 'ACCOUNT',
                'goid' => $goid
            ],
            'items' => [[
                'type' => 'ITEM',
                'name' => 'Test item',
                'amount' => 100,
                'count' => 1,
                'vat_rate' => '21'
            ]],
            'amount' => 100,
            'currency' => $currency,
            'order_number' => $order,
            'order_description' => 'Local GoPay Test Console test',
            'lang' => $lang,
            'callback' => array_filter([
                'return_url' => $cfg['returnUrl'],
                'notification_url' => $cfg['notificationUsable'] ? $cfg['notificationUrl'] : null
            ]),
            'additional_params' => [[
                'name' => 'source',
                'value' => 'gopay-test-console'
            ]]
        ];

        $defs = [
            new ActionDefinition('create_payment', 'Payments', 'Standard payment creation', 'Creates a standard payment and returns gw_url for redirect/inline gateway.', 'POST', '/api/payments/payment', 'createPayment', $basePayment, ['amount','currency','order_number','callback.return_url']),
            new ActionDefinition('payment_status', 'Payments', 'Payment status', 'Loads payment state by payment ID.', 'GET', '/api/payments/payment/{id}', 'getStatus', ['id' => ''], ['id'], true),
            new ActionDefinition('payment_refund', 'Payments', 'Payment refund', 'Refunds paid payment. Amount is in minor units. Use full or partial amount.', 'POST', '/api/payments/payment/{id}/refund', 'refundPayment', ['id' => '', 'amount' => 100], ['id','amount'], true, false, true),

            new ActionDefinition('create_preauth', 'Preauthorized payments', 'Preauthorized payment creation', 'Creates a card payment with preauthorization=true.', 'POST', '/api/payments/payment', 'createPayment', $basePayment + ['preauthorization' => true], ['amount','currency','preauthorization','callback.return_url']),
            new ActionDefinition('capture_preauth', 'Preauthorized payments', 'Capturing a preauthorized payment', 'Captures previously blocked funds in full.', 'POST', '/api/payments/payment/{id}/capture', 'captureAuthorization', ['id' => ''], ['id'], true),
            new ActionDefinition('capture_preauth_partial', 'Preauthorized payments', 'Partially capturing a preauthorized payment', 'Captures a lower amount and releases the rest.', 'POST', '/api/payments/payment/{id}/capture', 'captureAuthorizationPartial', ['id' => '', 'amount' => 100, 'items' => [['type' => 'ITEM', 'name' => 'Partial item', 'amount' => 100, 'count' => 1]]], ['id','amount'], true),
            new ActionDefinition('void_preauth', 'Preauthorized payments', 'Cancelling a preauthorized payment', 'Voids authorization and releases blocked funds.', 'POST', '/api/payments/payment/{id}/void-authorization', 'voidAuthorization', ['id' => ''], ['id'], true, false, true),

            new ActionDefinition('create_recurrence_init', 'Recurring payments', 'Recurrent payment creation', 'Creates the initial recurrent payment. For ON_DEMAND, recurrence_period is not used.', 'POST', '/api/payments/payment', 'createPayment', array_replace_recursive($basePayment, [
                'recurrence' => [
                    'recurrence_cycle' => 'ON_DEMAND',
                    'recurrence_date_to' => date('Y-m-d', strtotime('+1 year'))
                ]
            ]), ['amount','currency','recurrence','callback.return_url']),
            new ActionDefinition('create_recurrence_on_demand', 'Recurring payments', 'Recurring on demand', 'Creates a subsequent ON_DEMAND recurrent payment from parent payment ID.', 'POST', '/api/payments/payment/{id}/create-recurrence', 'createRecurrence', ['id' => '', 'amount' => 100, 'currency' => $currency, 'order_number' => 'REC-' . date('Ymd-His'), 'order_description' => 'ON_DEMAND recurrence test'], ['id','amount','currency','order_number'], true),
            new ActionDefinition('void_recurrence', 'Recurring payments', 'Cancellation of recurring payment', 'Cancels an active recurrence.', 'POST', '/api/payments/payment/{id}/void-recurrence', 'voidRecurrence', ['id' => ''], ['id'], true, false, true),

            new ActionDefinition('payment_methods_currency', 'Payment methods', 'Allowed payment methods for currency', 'Returns allowed payment methods for GoID and currency.', 'GET', '/api/eshops/eshop/{goid}/payment-instruments/{currency}', 'getPaymentInstruments', ['goid' => $goid, 'currency' => $currency], ['goid','currency']),
            new ActionDefinition('payment_methods_all', 'Payment methods', 'All allowed payment methods', 'Returns all allowed payment methods for GoID.', 'GET', '/api/eshops/eshop/{goid}/payment-instruments', 'getPaymentInstrumentsAll', ['goid' => $goid], ['goid']),

            new ActionDefinition('card_details', 'Saved cards', 'Get payment card details', 'Loads saved payment card details by card ID.', 'GET', '/api/payment-cards/{card_id}', 'getCardDetails', ['card_id' => ''], ['card_id'], false, true),
            new ActionDefinition('delete_card', 'Saved cards', 'Delete a saved card', 'Deletes a saved payment card token by card ID.', 'DELETE', '/api/payment-cards/{card_id}', 'deleteCard', ['card_id' => ''], ['card_id'], false, true, true),

            new ActionDefinition('account_statement', 'Merchant account', 'Account statement', 'Generates merchant account statement; response can be octet-stream.', 'POST', '/api/accounts/account-statement', 'getAccountStatement', ['date_from' => date('Y-m-d', strtotime('-7 days')), 'date_to' => date('Y-m-d'), 'goid' => $goid, 'currency' => $currency, 'format' => 'CSV_A'], ['date_from','date_to','goid','currency','format']),
        ];

        $out = [];
        foreach ($defs as $def) {
            $out[$def->key] = $def;
        }
        return $out;
    }
}
