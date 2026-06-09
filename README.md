# GoPay Test Console — React + Vite + Tailwind + Express

Lokální testovací konzole pro GoPay REST API. Projekt je přepis původní PHP verze do fullstack architektury:

- `frontend/` — React + Vite + Tailwind UI
- `backend/` — Node.js + Express REST proxy

UI se snaží držet původní „mission terminal“ vzhled, včetně akčních skupin, JSON editoru, request preview, cURL preview, response panelu, gateway odkazu a session historie.

## Co aplikace umí

- Přepínání prostředí: `sandbox`, `production`, `custom`
- Credentials z `.env` nebo custom session formuláře
- OAuth2 token flow přes GoPay REST API
- Volání GoPay REST endpointů přes Express backend
- Standard payment creation
- Payment status
- Refund
- Preauth create/capture/void
- Recurrence init/on-demand/void
- Payment methods
- Saved cards detail/delete
- Account statement
- Callback endpoint `/api/notify`
- Session history a poslední payment ID
- Připravený HTTP preview a cURL preview

## Instalace

```bash
npm install
cp .env.example .env
```

Vyplň credentials v `.env`.

## Spuštění

```bash
npm run dev
```

Frontend běží na:

```text
http://localhost:5173
```

Backend běží na:

```text
http://localhost:3001
```

## Produkční režim

Production režim je v UI dostupný, ale neber ho jako bezpečné veřejné nasazení. Je to lokální testovací konzole. Nebezpečné akce a production requesty mají potvrzovací dialog, ale veřejně bych to bez autentizace nepouštěl.

## Callback / notification URL

Lokální `localhost` není z GoPay dostupný. Pro callback testování použij veřejnou HTTPS adresu přes ngrok nebo Cloudflare Tunnel a nastav:

```env
GOPAY_ENABLE_NOTIFICATION_URL=true
GOPAY_DEFAULT_NOTIFICATION_URL=https://your-public-url.example/api/notify
```

Callback endpoint jen loguje příchozí request do:

```text
backend/storage/callbacks.jsonl
```

Skutečný stav platby se má následně ověřit přes payment status endpoint.

## Poznámky k implementaci

Backend používá přímé REST volání místo PHP SDK. Token je získáván přes `/api/oauth2/token` s `client_credentials` a scope `payment-all`, následné API requesty používají `Authorization: Bearer <access-token>`.

Token je cacheovaný v paměti procesu podle gateway URL, client ID a scope. Po restartu backendu se cache ztratí, což je pro lokální nástroj v pořádku.

## Omezení

- Projekt neobsahuje `node_modules`.
- Bez reálných credentials nejde ověřit skutečné GoPay requesty.
- Account statement může vracet jiný content-type než JSON; backend ho zobrazí jako raw body.
- Není to hotové bezpečné interní SaaS řešení. Je to lokální testovací nástroj.
