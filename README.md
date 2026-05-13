# GoPay Test Console v1.0

Local PHP testing console for GoPay REST API flows. It is built for local development on `localhost` and uses the official GoPay PHP SDK.

## What it does

- Switch between Sandbox, Production and Custom environment
- Use credentials from `.env` or enter temporary Custom credentials in the UI
- Run GoPay API actions from a single local console
- Edit request payloads directly as JSON
- See prepared endpoint and cURL preview before sending a request
- See success/error API responses clearly
- Detect payment ID from return URL and automatically check payment status
- Keep the last payment ID for follow-up actions such as status, refund, capture, void and recurrence
- Keep a small local request history and recent payment ID log
- Provide useful scenarios for special payment flows

## Requirements

- PHP 8.1+
- Composer
- PHP cURL extension
- PHP JSON extension

## Quick start

```bash
composer install
cp .env.example .env
composer serve
```

Open:

```text
http://localhost:8080
```

The PHP built-in server is a long-running process. Stop it with `Ctrl + C`.

## Windows one-click start

The project contains:

```text
start-gopay-test-console.bat
```

You can create a desktop shortcut to this file and start the app without opening VS Code.

The BAT file does this:

- switches to the project directory
- checks that PHP exists in PATH
- runs `composer install` automatically if `vendor/autoload.php` is missing
- creates `.env` from `.env.example` if it does not exist
- opens `http://localhost:8080` in the browser
- starts the PHP local server

Keep the terminal window open while using the app. Close it with `Ctrl + C`.

## Environment configuration

Copy `.env.example` to `.env` and fill in credentials:

```env
GOPAY_SANDBOX_GOID=
GOPAY_SANDBOX_CLIENT_ID=
GOPAY_SANDBOX_CLIENT_SECRET=

GOPAY_PRODUCTION_GOID=
GOPAY_PRODUCTION_CLIENT_ID=
GOPAY_PRODUCTION_CLIENT_SECRET=
```

The app supports:

- Sandbox credentials from `.env`
- Production credentials from `.env`
- Custom credentials entered directly in the UI

Custom credentials are stored only in the PHP session for the current local run. They are not stored in browser localStorage/sessionStorage.

## Notification URL behavior

`notification_url` is disabled by default for localhost development because GoPay cannot reach `localhost` from the internet.

For callback testing, expose your local app with ngrok, Cloudflare Tunnel or a similar public HTTPS tunnel and set:

```env
GOPAY_ENABLE_NOTIFICATION_URL=true
GOPAY_DEFAULT_NOTIFICATION_URL=https://your-public-url.example/notify.php
```

The Callback Monitor panel shows the configured callback status.

## Session history

The app keeps:

- request history in `storage/history/requests.jsonl`
- recent payment IDs in PHP session
- the active last payment ID in PHP session

Use the small **CLEAR** button in the Session History panel to clear request history and recent payment IDs.

This is a local testing history, not an audit log.

## Scenarios

The app includes only non-obvious scenarios that are useful shortcuts over manual payload editing.

### Free trial card verification

Creates a card verification payload without charging money:

- `amount: 0`
- `preauthorization: true`
- `recurrence_cycle: ON_DEMAND`
- `PAYMENT_CARD`

### Request card token

Creates a paid card payment payload with card token request enabled:

- `amount: 100`
- `payer.request_card_token: true`
- `PAYMENT_CARD`

### Create automatic recurring payment

Creates a monthly automatic recurring payment payload:

- `amount: 100`
- `recurrence_cycle: MONTH`
- `recurrence_period: 1`
- `PAYMENT_CARD`

## Project structure

```text
app/
  Config.php
  ActionDefinition.php
  Actions.php
  GoPayClientFactory.php
  TerminalController.php

public/
  index.php
  notify.php
  assets/
    app.css
    app.js

storage/
  cache/
  history/

.env.example
composer.json
start-gopay-test-console.bat
```

## Important note

This is a local testing tool. Do not deploy it publicly with real credentials.
