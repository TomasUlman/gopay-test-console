<?php

$root = dirname(__DIR__);
$vendor = $root . '/vendor/autoload.php';
if (!is_file($vendor)) {
    http_response_code(200);
    echo '<!doctype html><html lang="en"><meta charset="utf-8"><title>GoPay Test Console</title><style>body{background:#07111f;color:#d7fffb;font-family:system-ui;padding:48px}code,pre{background:#0d1d33;padding:12px;border-radius:10px;display:block}.box{max-width:860px;border:1px solid #1f8;box-shadow:0 0 40px #00ff8855;padding:28px;border-radius:18px}</style><div class="box"><div style="color:#4dfcff;letter-spacing:.22em;font:700 11px monospace">LOCAL PHP TESTING HUB</div><h1>GoPay Test Console <span class="version-badge">v1.0</span></h1><p>Install Composer packages first:</p><code>composer install</code><p>Then copy the environment file:</p><code>cp .env.example .env</code><p>Fill in your credentials and start the app:</p><code>composer serve</code></div></html>';
    exit;
}

require $vendor;

use Dotenv\Dotenv;
use MissionTerminal\Config;
use MissionTerminal\TerminalController;

session_start();

if (is_file($root . '/.env')) {
    Dotenv::createImmutable($root)->safeLoad();
}

function e(mixed $value): string
{
    return htmlspecialchars((string)$value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function pretty(mixed $value): string
{
    if ($value === null || $value === '') return '';
    if (is_string($value)) return $value;
    return json_encode($value, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
}

$state = (new TerminalController(Config::load()))->handle();
$cfg = $state['cfg'];
$masked = $state['maskedCfg'];
$custom = $state['customState'];
$actions = $state['actions'];
$scenarios = $state['scenarios'];
$action = $state['action'];
$result = $state['result'];
$autoStatus = $state['autoStatusResult'];
$lastPaymentId = $state['lastPaymentId'];

$groups = [];
foreach ($actions as $key => $def) {
    $groups[$def->group][$key] = $def;
}

$initialToast = null;
if ($result) {
    $initialToast = [
        'type' => $result['success'] ? 'success' : 'error',
        'message' => $result['success'] ? 'Response received successfully.' : 'Response received with an error.',
    ];
} elseif ($autoStatus) {
    $initialToast = [
        'type' => $autoStatus['success'] ? 'success' : 'error',
        'message' => $autoStatus['success'] ? 'Auto status check completed.' : 'Auto status check failed.',
    ];
} elseif ($state['scenarioLoaded']) {
    $initialToast = [
        'type' => 'success',
        'message' => 'Scenario loaded: ' . $state['scenarioLoaded'],
    ];
} elseif ($state['customSaved']) {
    $initialToast = [
        'type' => 'success',
        'message' => 'Custom environment saved for this PHP session.',
    ];
} elseif ($state['historyCleared']) {
    $initialToast = [
        'type' => 'success',
        'message' => 'Session history cleared.',
    ];
}
?>
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="icon" href="/favicon.ico?v=3" type="image/x-icon">
    <link rel="shortcut icon" href="/favicon.ico?v=3" type="image/x-icon">
    <title>GoPay Test Console</title>
    <link rel="stylesheet" href="/assets/app.css">
</head>
<body
    data-has-result="<?= $result ? '1' : '0' ?>"
    data-has-auto-status="<?= $autoStatus ? '1' : '0' ?>"
    data-initial-toast="<?= e($initialToast ? json_encode($initialToast, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) : '') ?>"
>
<div class="stars"></div>
<header class="topbar">
    <div>
        <div class="eyebrow">LOCAL PHP TESTING HUB</div>
        <h1>GoPay Test Console <span class="version-badge">v1.0</span></h1>
    </div>
    <form method="get" class="env-switch" data-feedback-form="Switching environment...">
        <label for="environmentSelect">Environment</label>
        <select id="environmentSelect" name="environment" data-feedback-change="Environment changed.">
            <option value="sandbox" <?= $cfg['environment'] === 'sandbox' ? 'selected' : '' ?>>SANDBOX</option>
            <option value="production" <?= $cfg['environment'] === 'production' ? 'selected' : '' ?>>PRODUCTION</option>
            <option value="custom" <?= $cfg['environment'] === 'custom' ? 'selected' : '' ?>>CUSTOM</option>
        </select>
        <input type="hidden" name="action" value="<?= e($action->key) ?>">
    </form>
</header>

<section class="status-strip <?= $cfg['mode'] === 'production' ? 'danger-zone' : '' ?>">
    <div><span>ENV</span><strong><?= e(strtoupper($cfg['environment'])) ?></strong></div>
    <div><span>Mode</span><strong><?= e(strtoupper($cfg['mode'])) ?></strong></div>
    <div><span>GoID</span><strong><?= e($masked['goid'] ?: 'not-set') ?></strong></div>
    <div><span>Client</span><strong><?= e($masked['clientId']) ?></strong></div>
    <div><span>Gateway</span><strong><?= e($masked['gatewayUrl'] ?: 'not-set') ?></strong></div>
    <div><span>Last payment</span><strong><?= e($lastPaymentId ?: 'none') ?></strong></div>
</section>

<?php if ($cfg['environment'] === 'custom'): ?>
    <section class="panel custom-env-panel">
        <div class="panel-title">Custom Environment Credentials</div>
        <form method="post" class="custom-env-form" data-feedback-form="Saving custom environment...">
            <input type="hidden" name="intent" value="save_custom_env">
            <input type="hidden" name="environment" value="custom">
            <input type="hidden" name="action" value="<?= e($action->key) ?>">
            <label>
                <span>Mode</span>
                <select name="custom_mode">
                    <option value="sandbox" <?= $custom['mode'] === 'sandbox' ? 'selected' : '' ?>>Sandbox</option>
                    <option value="production" <?= $custom['mode'] === 'production' ? 'selected' : '' ?>>Production</option>
                </select>
            </label>
            <label>
                <span>GoID</span>
                <input name="custom_goid" value="<?= e($custom['goid']) ?>" placeholder="8123456789">
            </label>
            <label>
                <span>Client ID</span>
                <input name="custom_client_id" value="<?= e($custom['clientId']) ?>" placeholder="client_id">
            </label>
            <label>
                <span>Client Secret</span>
                <input name="custom_client_secret" type="password" value="<?= e($custom['clientSecret']) ?>" placeholder="client_secret">
            </label>
            <button type="submit" class="primary">SAVE CUSTOM ENV</button>
        </form>
        <p class="muted small-note">Custom credentials are kept only in the PHP session while this local app is running.</p>
    </section>
<?php endif; ?>

<?php if ($state['detectedPaymentId']): ?>
    <section class="notice pulse">
        Payment ID detected in return URL: <strong><?= e($state['detectedPaymentId']) ?></strong>. It is now stored as the active last payment ID and auto status check was executed.
    </section>
<?php endif; ?>

<main class="layout">
    <aside class="panel action-panel">
        <div class="panel-title">API Actions</div>
        <div class="actions-scroll">
            <?php foreach ($groups as $group => $items): ?>
                <h3><?= e($group) ?></h3>
                <?php foreach ($items as $key => $def): ?>
                    <a class="action <?= $key === $action->key ? 'active' : '' ?> <?= $def->danger ? 'danger' : '' ?>" href="/?environment=<?= e($cfg['environment']) ?>&action=<?= e($key) ?>" data-feedback="Loading <?= e($def->label) ?>...">
                        <span><?= e($def->method) ?></span>
                        <strong><?= e($def->label) ?></strong>
                        <small><?= e($def->sdkMethod) ?></small>
                    </a>
                <?php endforeach; ?>
            <?php endforeach; ?>

            <div class="scenario-block">
                <h3>Scenarios</h3>
                <?php foreach ($scenarios as $key => $scenario): ?>
                    <a class="scenario-card" href="/?environment=<?= e($cfg['environment']) ?>&scenario=<?= e($key) ?>" data-feedback="Loading scenario...">
                        <strong><?= e($scenario['label']) ?></strong>
                        <small><?= e($scenario['description']) ?></small>
                    </a>
                <?php endforeach; ?>
            </div>
        </div>
    </aside>

    <section class="panel editor-panel">
        <div class="panel-title">Payload Editor</div>
        <h2><?= e($action->label) ?></h2>
        <p class="muted"><?= e($action->description) ?></p>
        <?php if ($action->needsPaymentId && $lastPaymentId): ?>
            <div class="inline-hint">Last payment ID <code><?= e($lastPaymentId) ?></code> is prefilled for this follow-up action.</div>
        <?php endif; ?>
        <form method="post" id="terminalForm" data-request-form>
            <input type="hidden" name="intent" value="send">
            <input type="hidden" name="environment" value="<?= e($cfg['environment']) ?>">
            <input type="hidden" name="action" value="<?= e($action->key) ?>">
            <textarea name="payload" spellcheck="false" id="payloadEditor"><?= e($state['payloadText']) ?></textarea>
            <div class="button-row">
                <button type="submit" class="primary <?= $action->danger ? 'danger-button' : '' ?>" data-send-request>SEND REQUEST</button>
                <button type="button" data-format-json>FORMAT JSON</button>
                <a class="button" href="/?environment=<?= e($cfg['environment']) ?>&action=<?= e($action->key) ?>" data-feedback="Resetting payload...">RESET PAYLOAD</a>
            </div>
        </form>
    </section>

    <section class="panel request-panel">
        <div class="panel-title">Prepared Request</div>
        <div class="endpoint-line">
            <span class="method"><?= e($state['prepared']['method']) ?></span>
            <code id="preparedEndpoint"><?= e($state['prepared']['url']) ?></code>
        </div>
        <div class="curl-label">cURL preview</div>
        <pre id="preparedCurl" class="curl-preview"><?= e($state['prepared']['curl']) ?></pre>
        <div class="button-row compact">
            <button type="button" data-copy-target="preparedEndpoint">COPY ENDPOINT</button>
            <button type="button" data-copy-textarea="payloadEditor">COPY PAYLOAD</button>
            <button type="button" data-copy-target="preparedCurl">COPY cURL</button>
        </div>
    </section>
</main>

<section class="bottom-grid">
    <div class="panel response-panel <?= $result ? ($result['success'] ? 'success' : 'error') : '' ?>" data-response-panel>
        <div class="panel-title">API Response</div>
        <?php if (!$result): ?>
            <div class="empty">No request has been sent yet.</div>
        <?php else: ?>
            <div class="response-head">
                <strong><?= $result['success'] ? 'SUCCESS' : 'ERROR' ?></strong>
                <span>HTTP <?= e($result['statusCode'] ?? 'N/A') ?></span>
                <span><?= e($result['durationMs']) ?> ms</span>
            </div>
            <?php if ($result['error']): ?><div class="error-text"><?= e($result['error']) ?></div><?php endif; ?>
            <pre><?= e(pretty($result['json']) ?: $result['rawBody']) ?></pre>
            <?php if (!empty($result['json']['gw_url'])): ?>
                <div class="button-row"><a class="button primary" href="<?= e($result['json']['gw_url']) ?>" data-feedback="Opening gateway in this window...">OPEN GATEWAY</a></div>
            <?php endif; ?>
            <?php if (!empty($result['json']['id'])): ?>
                <div class="next-actions">
                    <a class="button" href="/?environment=<?= e($cfg['environment']) ?>&action=payment_status&id=<?= e($result['json']['id']) ?>" data-feedback="Checking payment status...">CHECK STATUS</a>
                    <a class="button" href="/?environment=<?= e($cfg['environment']) ?>&action=payment_refund&id=<?= e($result['json']['id']) ?>" data-feedback="Loading refund action...">START REFUND</a>
                    <span>Payment ID: <code><?= e($result['json']['id']) ?></code></span>
                </div>
            <?php endif; ?>
        <?php endif; ?>
    </div>

    <div class="panel status-panel <?= $autoStatus ? ($autoStatus['success'] ? 'success' : 'error') : '' ?>" data-status-panel>
        <div class="panel-title">Return URL Auto Status</div>
        <?php if (!$autoStatus): ?>
            <div class="empty">After returning from the gateway, the app expects the payment ID in one of these query parameters: <code>id</code>, <code>payment_id</code>, or <code>paymentId</code>.</div>
        <?php else: ?>
            <div class="response-head">
                <strong><?= $autoStatus['success'] ? 'STATUS OK' : 'STATUS ERROR' ?></strong>
                <span>HTTP <?= e($autoStatus['statusCode'] ?? 'N/A') ?></span>
                <span><?= e($autoStatus['durationMs']) ?> ms</span>
            </div>
            <pre><?= e(pretty($autoStatus['json']) ?: $autoStatus['rawBody'] ?: $autoStatus['error']) ?></pre>
        <?php endif; ?>
    </div>

    <div class="panel history-panel">
        <div class="panel-header">
            <div class="panel-title">Session History</div>
            <form method="post" class="inline-form" data-feedback-form="Clearing session history...">
                <input type="hidden" name="intent" value="clear_history">
                <input type="hidden" name="environment" value="<?= e($cfg['environment']) ?>">
                <input type="hidden" name="action" value="<?= e($action->key) ?>">
                <button type="submit" class="tiny-button" onclick="return confirm('Clear request history and recent payment IDs?');">CLEAR</button>
            </form>
        </div>
        <?php if ($state['recentPaymentIds']): ?>
            <div class="payment-id-log">
                <h3>Recent payment IDs</h3>
                <?php foreach ($state['recentPaymentIds'] as $payment): ?>
                    <a class="payment-chip" href="/?environment=<?= e($cfg['environment']) ?>&action=payment_status&id=<?= e($payment['id']) ?>" data-feedback="Loading payment status...">
                        <code><?= e($payment['id']) ?></code>
                        <span><?= e($payment['source']) ?></span>
                    </a>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>
        <?php if (!$state['history']): ?>
            <div class="empty">History is empty.</div>
        <?php else: ?>
            <?php foreach ($state['history'] as $item): ?>
                <div class="history-item <?= !empty($item['success']) ? 'ok' : 'fail' ?>">
                    <span><?= e(date('H:i:s', strtotime($item['time'] ?? 'now'))) ?></span>
                    <strong><?= e($item['label'] ?? $item['action'] ?? '') ?></strong>
                    <em>HTTP <?= e($item['statusCode'] ?? 'N/A') ?> · <?= e($item['durationMs'] ?? 0) ?> ms<?= !empty($item['paymentId']) ? ' · ID ' . e($item['paymentId']) : '' ?></em>
                </div>
            <?php endforeach; ?>
        <?php endif; ?>
    </div>

    <div class="panel callback-panel">
        <div class="panel-title">Callback Monitor</div>
        <p class="muted">
            Notification endpoint:
            <?php if ($cfg['notificationUsable']): ?>
                <code><?= e($cfg['notificationUrl']) ?></code>
            <?php else: ?>
                <code>disabled for localhost development</code>
            <?php endif; ?>
        </p>
        <?php if ($cfg['notificationWarning']): ?>
            <p class="muted callback-note"><?= e($cfg['notificationWarning']) ?></p>
        <?php endif; ?>
        <pre><?= e($state['callbacks'] ?: 'No callbacks received yet.') ?></pre>
    </div>
</section>

<script src="/assets/app.js"></script>
</body>
</html>
