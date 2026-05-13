<?php

namespace MissionTerminal;

final class Config
{
    public function __construct(private array $env) {}

    public static function load(): self
    {
        return new self($_ENV + $_SERVER);
    }

    public function get(string $key, mixed $default = null): mixed
    {
        $value = $this->env[$key] ?? getenv($key);
        return $value === false || $value === null || $value === '' ? $default : $value;
    }

    public function activeEnvironment(): string
    {
        $env = strtolower((string) $this->get('GOPAY_ACTIVE_ENV', 'sandbox'));
        return in_array($env, ['sandbox', 'production', 'custom'], true) ? $env : 'sandbox';
    }

    public function gopay(string $environment = null): array
    {
        $environment ??= $this->activeEnvironment();
        $environment = in_array($environment, ['sandbox', 'production', 'custom'], true) ? $environment : 'sandbox';

        if ($environment === 'custom') {
            return $this->customGopay();
        }

        $prefix = 'GOPAY_' . strtoupper($environment) . '_';
        $base = $this->commonConfig();

        return $base + [
            'environment' => $environment,
            'mode' => $environment,
            'goid' => (string) $this->get($prefix . 'GOID', ''),
            'clientId' => (string) $this->get($prefix . 'CLIENT_ID', ''),
            'clientSecret' => (string) $this->get($prefix . 'CLIENT_SECRET', ''),
            'gatewayUrl' => rtrim((string) $this->get($prefix . 'GATEWAY_URL', ''), '/'),
            'isCustom' => false,
        ];
    }

    public function customState(): array
    {
        $state = $_SESSION['custom_gopay'] ?? [];
        $mode = strtolower((string)($state['mode'] ?? 'sandbox'));
        $mode = in_array($mode, ['sandbox', 'production'], true) ? $mode : 'sandbox';

        return [
            'mode' => $mode,
            'goid' => (string)($state['goid'] ?? ''),
            'clientId' => (string)($state['clientId'] ?? ''),
            'clientSecret' => (string)($state['clientSecret'] ?? ''),
        ];
    }

    public function saveCustomState(array $input): void
    {
        $mode = strtolower((string)($input['custom_mode'] ?? 'sandbox'));
        $mode = in_array($mode, ['sandbox', 'production'], true) ? $mode : 'sandbox';

        $_SESSION['custom_gopay'] = [
            'mode' => $mode,
            'goid' => trim((string)($input['custom_goid'] ?? '')),
            'clientId' => trim((string)($input['custom_client_id'] ?? '')),
            'clientSecret' => trim((string)($input['custom_client_secret'] ?? '')),
        ];
    }

    public function maskedGopay(string $environment = null): array
    {
        $cfg = $this->gopay($environment);
        $cfg['clientId'] = $this->mask($cfg['clientId']);
        $cfg['clientSecret'] = $this->mask($cfg['clientSecret']);
        return $cfg;
    }

    private function customGopay(): array
    {
        $base = $this->commonConfig();
        $custom = $this->customState();
        $gateway = $custom['mode'] === 'production'
            ? (string)$this->get('GOPAY_PRODUCTION_GATEWAY_URL', 'https://gate.gopay.cz/api')
            : (string)$this->get('GOPAY_SANDBOX_GATEWAY_URL', 'https://gw.sandbox.gopay.com/api');

        return $base + [
            'environment' => 'custom',
            'mode' => $custom['mode'],
            'goid' => $custom['goid'],
            'clientId' => $custom['clientId'],
            'clientSecret' => $custom['clientSecret'],
            'gatewayUrl' => rtrim($gateway, '/'),
            'isCustom' => true,
        ];
    }

    private function commonConfig(): array
    {
        $notificationUrl = (string) $this->get('GOPAY_DEFAULT_NOTIFICATION_URL', '');
        $notificationEnabled = filter_var($this->get('GOPAY_ENABLE_NOTIFICATION_URL', false), FILTER_VALIDATE_BOOLEAN);
        $notificationUsable = $notificationEnabled && $notificationUrl !== '' && !$this->isLocalUrl($notificationUrl);

        return [
            'currency' => (string) $this->get('GOPAY_DEFAULT_CURRENCY', 'CZK'),
            'lang' => (string) $this->get('GOPAY_DEFAULT_LANG', 'CS'),
            'returnUrl' => (string) $this->get('GOPAY_DEFAULT_RETURN_URL', 'http://localhost:8080/?returned=1'),
            'notificationUrl' => $notificationUrl,
            'notificationEnabled' => $notificationEnabled,
            'notificationUsable' => $notificationUsable,
            'notificationWarning' => $this->notificationWarning($notificationEnabled, $notificationUrl, $notificationUsable),
            'autoStatusCheck' => filter_var($this->get('APP_AUTO_STATUS_CHECK', true), FILTER_VALIDATE_BOOLEAN),
        ];
    }

    private function mask(string $value): string
    {
        if ($value === '') {
            return 'not-set';
        }
        return substr($value, 0, 4) . str_repeat('*', max(4, strlen($value) - 4));
    }

    private function isLocalUrl(string $url): bool
    {
        $host = parse_url($url, PHP_URL_HOST);
        if (!$host) {
            return false;
        }

        return in_array(strtolower($host), ['localhost', '127.0.0.1', '::1'], true)
            || str_ends_with(strtolower($host), '.local');
    }

    private function notificationWarning(bool $enabled, string $url, bool $usable): string
    {
        if (!$enabled) {
            return 'Notification URL is disabled by default for localhost development. Use a public HTTPS tunnel such as ngrok or Cloudflare Tunnel if you want GoPay notifications locally.';
        }

        if ($url === '') {
            return 'Notification URL is enabled, but no URL is configured.';
        }

        if (!$usable) {
            return 'Configured notification URL looks local. GoPay cannot reach localhost from the internet.';
        }

        return '';
    }
}
