# GoPay Test Console — React + Vite + Tailwind + Express

Lokální testovací konzole pro GoPay REST API. Projekt je přepis původní PHP verze do fullstack architektury:

- `frontend/` — React + Vite + Tailwind UI
- `backend/` — Node.js + Express REST proxy

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
- Session history a poslední payment ID
- Připravený preview a cURL preview

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

## Callback / notification URL

Lokální `localhost` není z GoPay dostupný. Pro callback testování použij veřejnou HTTPS adresu přes ngrok nebo Cloudflare Tunnel a nastav:

```env
GOPAY_ENABLE_NOTIFICATION_URL=true
GOPAY_DEFAULT_NOTIFICATION_URL=https://your-public-url.example/api/notify
```

## Poznámky k implementaci

Backend používá přímé REST volání. Token je získáván přes `/api/oauth2/token` s `client_credentials` a scope `payment-all`, následné API requesty používají `Authorization: Bearer <access-token>`.

Token je cacheovaný v paměti procesu podle gateway URL, client ID a scope. Po restartu backendu se cache ztratí, což je pro lokální nástroj v pořádku.
