<?php

namespace MissionTerminal;

use Throwable;

final class TerminalController
{
    public function __construct(private Config $config) {}

    public function handle(): array
    {
        $intent = $_POST['intent'] ?? '';
        $customSaved = false;
        $historyCleared = false;

        if ($intent === 'clear_history') {
            $this->clearHistory();
            $historyCleared = true;
        }

        if ($intent === 'save_custom_env') {
            $this->config->saveCustomState($_POST);
            $_SESSION['selected_environment'] = 'custom';
            $customSaved = true;
        }

        $selectedEnv = $_POST['environment'] ?? $_GET['environment'] ?? $_SESSION['selected_environment'] ?? $this->config->activeEnvironment();
        $selectedEnv = in_array($selectedEnv, ['sandbox', 'production', 'custom'], true) ? $selectedEnv : 'sandbox';
        $_SESSION['selected_environment'] = $selectedEnv;

        $cfg = $this->config->gopay($selectedEnv);
        $actions = Actions::all($cfg);
        $detectedPaymentId = $this->detectPaymentId($_GET);

        if ($detectedPaymentId) {
            $this->rememberPaymentId($detectedPaymentId, 'return_url');
        }

        $scenarios = $this->scenarios($cfg, $actions);
        $scenarioKey = $_GET['scenario'] ?? null;
        $scenario = $scenarioKey && isset($scenarios[$scenarioKey]) ? $scenarios[$scenarioKey] : null;

        $actionKey = $_POST['action'] ?? $_GET['action'] ?? ($scenario['action'] ?? 'create_payment');
        $action = $actions[$actionKey] ?? $actions['create_payment'];

        if ($scenario && $_SERVER['REQUEST_METHOD'] !== 'POST') {
            $action = $actions[$scenario['action']] ?? $action;
            $payloadText = json_encode($scenario['payload'], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        } else {
            $defaultPayload = $this->prefillDefaultPayload($action, $_GET);
            $payloadText = $_POST['payload'] ?? json_encode($defaultPayload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        }

        $result = null;
        $autoStatusResult = null;

        if ($_SERVER['REQUEST_METHOD'] === 'POST' && $intent === 'send') {
            $result = $this->send($cfg, $action, $payloadText);
            $this->saveHistory($result);
            $this->rememberPaymentIdFromResult($result, 'api_response');
        }

        if ($detectedPaymentId && $cfg['autoStatusCheck']) {
            $statusAction = $actions['payment_status'];
            $autoStatusResult = $this->send($cfg, $statusAction, json_encode(['id' => $detectedPaymentId], JSON_PRETTY_PRINT));
            $this->rememberPaymentIdFromResult($autoStatusResult, 'auto_status');
        }

        return [
            'cfg' => $cfg,
            'maskedCfg' => $this->config->maskedGopay($selectedEnv),
            'customState' => $this->config->customState(),
            'actions' => $actions,
            'scenarios' => $scenarios,
            'scenarioLoaded' => $scenario ? $scenario['label'] : null,
            'customSaved' => $customSaved,
            'historyCleared' => $historyCleared,
            'action' => $action,
            'payloadText' => $payloadText,
            'prepared' => $this->preparedRequest($cfg, $action, $this->safeDecode($payloadText), $payloadText),
            'result' => $result,
            'detectedPaymentId' => $detectedPaymentId,
            'lastPaymentId' => $this->lastPaymentId(),
            'recentPaymentIds' => $this->recentPaymentIds(),
            'autoStatusResult' => $autoStatusResult,
            'history' => $this->readHistory(),
            'callbacks' => $this->readCallbacks(),
        ];
    }

    private function send(array $cfg, ActionDefinition $action, string $payloadText): array
    {
        $started = microtime(true);
        $payload = $this->safeDecode($payloadText);
        $prepared = $this->preparedRequest($cfg, $action, $payload, $payloadText);

        if ($payload === null) {
            return $this->errorResult($action, $prepared, 'Invalid JSON payload.', 0, microtime(true) - $started);
        }

        if (!$this->credentialsLookReady($cfg)) {
            return $this->errorResult($action, $prepared, 'Missing GoPay credentials for selected environment.', 0, microtime(true) - $started);
        }

        try {
            $gopay = GoPayClientFactory::make($cfg);
            $response = match ($action->sdkMethod) {
                'createPayment' => $gopay->createPayment($this->withoutMetaFields($payload)),
                'getStatus' => $gopay->getStatus((string)($payload['id'] ?? '')),
                'refundPayment' => $gopay->refundPayment((string)($payload['id'] ?? ''), (int)($payload['amount'] ?? 0)),
                'createRecurrence' => $gopay->createRecurrence((string)($payload['id'] ?? ''), $this->withoutMetaFields($payload, ['id'])),
                'voidRecurrence' => $gopay->voidRecurrence((string)($payload['id'] ?? '')),
                'captureAuthorization' => $gopay->captureAuthorization((string)($payload['id'] ?? '')),
                'captureAuthorizationPartial' => $gopay->captureAuthorizationPartial((string)($payload['id'] ?? ''), $this->withoutMetaFields($payload, ['id'])),
                'voidAuthorization' => $gopay->voidAuthorization((string)($payload['id'] ?? '')),
                'getCardDetails' => $gopay->getCardDetails((string)($payload['card_id'] ?? '')),
                'deleteCard' => $gopay->deleteCard((string)($payload['card_id'] ?? '')),
                'getPaymentInstruments' => $gopay->getPaymentInstruments((string)($payload['goid'] ?? $cfg['goid']), (string)($payload['currency'] ?? $cfg['currency'])),
                'getPaymentInstrumentsAll' => $gopay->getPaymentInstrumentsAll((string)($payload['goid'] ?? $cfg['goid'])),
                'getAccountStatement' => $gopay->getAccountStatement($this->withoutMetaFields($payload)),
                default => throw new \RuntimeException('Unsupported SDK method: ' . $action->sdkMethod),
            };

            $duration = microtime(true) - $started;
            return [
                'time' => date('c'),
                'action' => $action->key,
                'label' => $action->label,
                'success' => method_exists($response, 'hasSucceed') ? $response->hasSucceed() : false,
                'statusCode' => $response->statusCode ?? null,
                'durationMs' => (int) round($duration * 1000),
                'prepared' => $prepared,
                'json' => $response->json ?? null,
                'rawBody' => $response->rawBody ?? (string)$response,
                'paymentId' => $this->extractPaymentId($response->json ?? null),
                'error' => null,
            ];
        } catch (Throwable $e) {
            return $this->errorResult($action, $prepared, $e->getMessage(), 0, microtime(true) - $started);
        }
    }

    private function preparedRequest(array $cfg, ActionDefinition $action, ?array $payload, string $payloadText = ''): array
    {
        $endpoint = $action->endpoint;
        $map = [
            '{id}' => (string)($payload['id'] ?? ''),
            '{card_id}' => (string)($payload['card_id'] ?? ''),
            '{goid}' => (string)($payload['goid'] ?? $cfg['goid']),
            '{currency}' => (string)($payload['currency'] ?? $cfg['currency']),
        ];
        $resolvedEndpoint = strtr($endpoint, $map);
        $url = $this->resolveUrl($cfg['gatewayUrl'], $resolvedEndpoint);
        $body = in_array($action->method, ['GET','DELETE'], true) ? null : $this->withoutMetaFields($payload ?? []);
        $payloadSummary = $this->payloadSummary($payload, $payloadText, $body !== null);
        $headers = [
            'Authorization' => 'Bearer <managed by official GoPay PHP SDK>',
            'Accept' => 'application/json',
            'Content-Type' => $action->method === 'GET' ? 'application/x-www-form-urlencoded' : 'application/json',
        ];

        return [
            'method' => $action->method,
            'endpoint' => $resolvedEndpoint,
            'url' => $url,
            'host' => parse_url($url, PHP_URL_HOST) ?: 'gateway',
            'sdkMethod' => $action->sdkMethod,
            'headers' => $headers,
            'body' => $body,
            'payloadSummary' => $payloadSummary,
            'http' => $this->httpPreview($cfg, $action, $resolvedEndpoint, $url, $payloadSummary, $headers),
            'curl' => $this->curl($cfg, $action, $resolvedEndpoint, $payload ?? []),
        ];
    }

    private function httpPreview(array $cfg, ActionDefinition $action, string $endpoint, string $url, array $summary, array $headers): string
    {
        $path = parse_url($url, PHP_URL_PATH) ?: $endpoint;
        $query = parse_url($url, PHP_URL_QUERY);
        if ($query) {
            $path .= '?' . $query;
        }

        $lines = [
            $action->method . ' ' . $path . ' HTTP/1.1',
            'Host: ' . (parse_url($url, PHP_URL_HOST) ?: 'gateway'),
            'Environment: ' . strtoupper((string)$cfg['environment']) . ($cfg['environment'] === 'custom' ? ' / ' . strtoupper((string)$cfg['mode']) : ''),
            'GoID: ' . (($cfg['goid'] ?? '') !== '' ? (string)$cfg['goid'] : 'not-set'),
            'Authorization: ' . $headers['Authorization'],
            'Accept: ' . $headers['Accept'],
        ];

        if (!in_array($action->method, ['GET','DELETE'], true)) {
            $lines[] = 'Content-Type: application/json';
            $lines[] = 'Payload-Source: JSON editor';
            $lines[] = 'Payload-Status: ' . $summary['status'];
            $lines[] = 'Payload-Size: ' . $summary['size'];
            $lines[] = 'Payload-Fields: ' . $summary['fields'];
            $lines[] = 'Includes-Return-URL: ' . ($summary['hasReturnUrl'] ? 'yes' : 'no');
            $lines[] = 'Includes-Notification-URL: ' . ($summary['hasNotificationUrl'] ? 'yes' : 'no');
        } else {
            $lines[] = 'Payload: not used for this method';
        }

        return implode(PHP_EOL, $lines);
    }

    private function payloadSummary(?array $payload, string $payloadText, bool $hasBody): array
    {
        if (!$hasBody) {
            return ['status' => 'No body', 'size' => '0 B', 'fields' => '0', 'hasReturnUrl' => false, 'hasNotificationUrl' => false];
        }

        if ($payload === null) {
            return ['status' => 'Invalid JSON', 'size' => strlen($payloadText) . ' B', 'fields' => 'N/A', 'hasReturnUrl' => false, 'hasNotificationUrl' => false];
        }

        $body = json_encode($this->withoutMetaFields($payload), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?: '';
        return [
            'status' => 'Valid JSON',
            'size' => $this->humanBytes(strlen($body)),
            'fields' => (string)$this->countFields($payload),
            'hasReturnUrl' => !empty($payload['callback']['return_url']),
            'hasNotificationUrl' => !empty($payload['callback']['notification_url']),
        ];
    }

    private function curl(array $cfg, ActionDefinition $action, string $endpoint, array $payload): string
    {
        $cmd = 'curl -X ' . $action->method . ' "' . $this->resolveUrl($cfg['gatewayUrl'], $endpoint) . '"';
        $cmd .= " \\\n  -H \"Accept: application/json\"";
        $cmd .= " \\\n  -H \"Authorization: Bearer <access-token-from-sdk>\"";
        if (!in_array($action->method, ['GET','DELETE'], true)) {
            $cmd .= " \\\n  -H \"Content-Type: application/json\"";
            $cmd .= " \\\n  -d '" . json_encode($this->withoutMetaFields($payload), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "'";
        }
        return $cmd;
    }

    private function resolveUrl(string $gatewayUrl, string $endpoint): string
    {
        $base = rtrim($gatewayUrl, '/');
        if (str_ends_with($base, '/api') && str_starts_with($endpoint, '/api/')) {
            return $base . substr($endpoint, 4);
        }
        return $base . '/' . ltrim($endpoint, '/');
    }

    private function prefillDefaultPayload(ActionDefinition $action, array $query = []): array
    {
        $payload = $action->defaultPayload;

        $id = $query['id'] ?? $query['payment_id'] ?? $query['paymentId'] ?? null;
        if (!$id && $action->needsPaymentId) {
            $id = $this->lastPaymentId();
        }
        if ($id && isset($payload['id'])) {
            $payload['id'] = (string)$id;
        }

        if (!empty($query['card_id']) && isset($payload['card_id'])) {
            $payload['card_id'] = (string)$query['card_id'];
        }

        return $payload;
    }

    private function scenarios(array $cfg, array $actions): array
    {
        $base = $actions['create_payment']->defaultPayload;
        $orderSuffix = date('Ymd-His');

        $cardOnly = function (array $payload): array {
            $payload['payer']['allowed_payment_instruments'] = ['PAYMENT_CARD'];
            $payload['payer']['default_payment_instrument'] = 'PAYMENT_CARD';
            return $payload;
        };

        $freeTrial = $cardOnly($base);
        $freeTrial['amount'] = 0;
        $freeTrial['items'][0]['amount'] = 0;
        $freeTrial['order_number'] = 'FREE-TRIAL-' . $orderSuffix;
        $freeTrial['order_description'] = 'Free trial card verification';
        $freeTrial['preauthorization'] = true;
        $freeTrial['recurrence'] = [
            'recurrence_cycle' => 'ON_DEMAND',
            'recurrence_date_to' => date('Y-m-d', strtotime('+1 year')),
        ];

        $cardToken = $cardOnly($base);
        $cardToken['amount'] = 100;
        $cardToken['items'][0]['amount'] = 100;
        $cardToken['order_number'] = 'CARD-TOKEN-' . $orderSuffix;
        $cardToken['order_description'] = 'Request card token test';
        $cardToken['payer']['request_card_token'] = true;

        $monthly = $cardOnly($base);
        $monthly['amount'] = 100;
        $monthly['items'][0]['amount'] = 100;
        $monthly['order_number'] = 'MONTHLY-SUB-' . $orderSuffix;
        $monthly['order_description'] = 'Automatic monthly recurring payment test';
        $monthly['recurrence'] = [
            'recurrence_cycle' => 'MONTH',
            'recurrence_period' => 1,
            'recurrence_date_to' => date('Y-m-d', strtotime('+1 year')),
        ];

        return [
            'free_trial_card_verification' => [
                'label' => 'Free trial card verification',
                'description' => 'Amount 0 + preauthorization + ON_DEMAND recurrence for card verification.',
                'action' => 'create_recurrence_init',
                'payload' => $freeTrial,
            ],
            'request_card_token' => [
                'label' => 'Request card token',
                'description' => 'Paid card payment with payer.request_card_token enabled.',
                'action' => 'create_payment',
                'payload' => $cardToken,
            ],
            'create_automatic_recurring_payment' => [
                'label' => 'Create automatic recurring payment',
                'description' => 'Monthly card recurrence with an initial paid payment.',
                'action' => 'create_recurrence_init',
                'payload' => $monthly,
            ],
        ];
    }

    private function withoutMetaFields(array $payload, array $extra = []): array
    {
        foreach (array_merge(['id', 'card_id'], $extra) as $field) {
            unset($payload[$field]);
        }
        return $payload;
    }

    private function safeDecode(string $json): ?array
    {
        $decoded = json_decode($json, true);
        return json_last_error() === JSON_ERROR_NONE && is_array($decoded) ? $decoded : null;
    }

    private function credentialsLookReady(array $cfg): bool
    {
        return $cfg['goid'] !== '' && $cfg['clientId'] !== '' && $cfg['clientSecret'] !== '' && $cfg['gatewayUrl'] !== ''
            && !str_contains($cfg['clientId'], 'your_') && !str_contains($cfg['clientSecret'], 'your_');
    }

    private function errorResult(ActionDefinition $action, array $prepared, string $message, ?int $statusCode, float $duration): array
    {
        return [
            'time' => date('c'),
            'action' => $action->key,
            'label' => $action->label,
            'success' => false,
            'statusCode' => $statusCode,
            'durationMs' => (int) round($duration * 1000),
            'prepared' => $prepared,
            'json' => null,
            'rawBody' => '',
            'paymentId' => null,
            'error' => $message,
        ];
    }

    private function detectPaymentId(array $query): ?string
    {
        foreach (['id', 'payment_id', 'paymentId'] as $key) {
            if (!empty($query[$key]) && preg_match('/^[0-9]+$/', (string)$query[$key])) {
                return (string)$query[$key];
            }
        }
        return null;
    }

    private function rememberPaymentIdFromResult(?array $result, string $source): void
    {
        if (!$result) return;
        $id = $result['paymentId'] ?? $this->extractPaymentId($result['json'] ?? null);
        if ($id) {
            $this->rememberPaymentId((string)$id, $source);
        }
    }

    private function extractPaymentId(mixed $json): ?string
    {
        if (!is_array($json)) return null;
        foreach (['id', 'payment_id', 'paymentId', 'parent_id'] as $key) {
            if (!empty($json[$key]) && preg_match('/^[0-9]+$/', (string)$json[$key])) {
                return (string)$json[$key];
            }
        }
        return null;
    }

    private function rememberPaymentId(string $id, string $source): void
    {
        $_SESSION['last_payment_id'] = $id;
        $_SESSION['payment_ids'] ??= [];
        $_SESSION['payment_ids'] = array_values(array_filter($_SESSION['payment_ids'], fn($item) => ($item['id'] ?? '') !== $id));
        array_unshift($_SESSION['payment_ids'], [
            'id' => $id,
            'source' => $source,
            'time' => date('c'),
        ]);
        $_SESSION['payment_ids'] = array_slice($_SESSION['payment_ids'], 0, 8);
    }

    private function lastPaymentId(): ?string
    {
        return $_SESSION['last_payment_id'] ?? null;
    }

    private function recentPaymentIds(): array
    {
        return $_SESSION['payment_ids'] ?? [];
    }

    private function saveHistory(?array $result): void
    {
        if (!$result) return;
        $file = dirname(__DIR__) . '/storage/history/requests.jsonl';
        file_put_contents($file, json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL, FILE_APPEND);
    }


    private function clearHistory(): void
    {
        unset($_SESSION['payment_ids'], $_SESSION['last_payment_id']);

        $file = dirname(__DIR__) . '/storage/history/requests.jsonl';
        if (is_file($file)) {
            file_put_contents($file, '');
        }
    }

    private function readHistory(): array
    {
        $file = dirname(__DIR__) . '/storage/history/requests.jsonl';
        if (!is_file($file)) return [];
        $lines = array_slice(file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES), -20);
        return array_reverse(array_map(fn($line) => json_decode($line, true), $lines));
    }

    private function readCallbacks(): string
    {
        $file = dirname(__DIR__) . '/storage/history/callbacks.log';
        if (!is_file($file)) return '';
        return substr(file_get_contents($file), -8000);
    }

    private function countFields(array $payload): int
    {
        $count = 0;
        array_walk_recursive($payload, function () use (&$count) {
            $count++;
        });
        return $count;
    }

    private function humanBytes(int $bytes): string
    {
        if ($bytes < 1024) return $bytes . ' B';
        return round($bytes / 1024, 1) . ' KB';
    }
}
