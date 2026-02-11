# KOBPAY Backend

KOBPAY backend is a Node.js (Express) API backed by PostgreSQL.

## Repo structure
- `src/` Express routes, services, and config
- `prisma/` Prisma schema and migrations
- `docs/` API notes, environment docs, setup guides
- `scripts/` Local test scripts

## Quick start (Windows)
### 1) Start PostgreSQL
Docker is recommended on Windows for parity and fewer PATH/version issues.

```powershell
docker compose up -d
```

The docker-compose mapping exposes Postgres on **localhost:5433**.

### 2) Backend environment
```powershell
Copy-Item .env.example .env
```

Update the values in `.env` (see `docs/ENV.md` for details).

### 3) Install deps and run
```powershell
npm install
npm run prisma:migrate
npm run dev
```

API should be at: `http://localhost:4000`  
Swagger UI: `http://localhost:4000/api/docs`

## Webhooks (Flutterwave)
Use ngrok for local webhooks:

```powershell
ngrok http 4000
```

Set Flutterwave webhook URL to:
```
https://<your-ngrok>.ngrok-free.app/api/webhooks/flutterwave
```

Ensure `FLW_WEBHOOK_SECRET` in `.env` matches the secret set in Flutterwave.

## Environment reference
See `docs/ENV.md` for all backend environment variables.
Bills testing guide: `docs/BILLS_TESTING.md`.

## API endpoint reference (brief)
All endpoints are prefixed with `/api`.

Auth
- `POST /auth/otp/request` (signup OTP)
- `POST /auth/otp/verify` (signup + password)
- `POST /auth/login`
- `POST /auth/refresh`

Profile
- `GET /me`
- `POST /me/pin`
- `POST /me/pin/change`

Wallet
- `GET /wallet`
- `POST /wallet/fund/initialize`
- `POST /wallet/fund/verify`
- `POST /wallet/virtual-account` (dynamic funding account)

Billers
- `GET /billers` (categories)
- `GET /billers?category=...` (billers in category)
- `GET /billers/:billerId/plans` (bill items)
- `GET /billers/validate` (customer validation)
- `POST /billers/pay`

Giftcards
- `POST /giftcards/purchase`

Banks/Withdrawals
- `GET /banks`
- `POST /banks/resolve`
- `GET /banks/accounts`
- `POST /withdrawals`

Transactions
- `GET /transactions`
- `GET /transactions/:id`
- `GET /transactions/:id/receipt`

Exchange
- `GET /exchange/rates`
- `POST /exchange/trades`
- `GET /exchange/trades/:id`
- `POST /exchange/trades/:id/receipt`
- `POST /exchange/trades/:id/paid`
- `POST /exchange/trades/:id/cancel`
- FX rates config: `src/config/fxRates.ts`
- Pay-to bank details config: `src/config/exchangePayTo.ts`

Admin: Exchange approvals
- Admin routes live in `src/routes/admin/exchangeTrades.ts`
- Base path: `/api/admin/exchange/trades` (requires `x-admin-key`)

Examples:
```bash
curl -H "x-admin-key: <ADMIN_API_KEY>" \
  "http://localhost:4000/api/admin/exchange/trades?status=PAID_AWAITING_CONFIRMATION"

curl -X POST -H "x-admin-key: <ADMIN_API_KEY>" \
  "http://localhost:4000/api/admin/exchange/trades/<id>/payment-received"

curl -X POST -H "x-admin-key: <ADMIN_API_KEY>" \
  "http://localhost:4000/api/admin/exchange/trades/<id>/complete"
```

Webhooks
- `POST /webhooks/flutterwave` (see `docs/WEBHOOKS.md`)

## Progress
See `docs/PROGRESS.md` for milestone tracking.
