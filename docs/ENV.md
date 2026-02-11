# Environment variables

This document explains each environment variable and recommended dev values.

## Server
- `NODE_ENV`: `development` for local dev.
- `PORT`: API port, default `4000`.
- `API_BASE_URL`: Base URL for API, default `http://localhost:4000`.

## Database
- `DATABASE_URL`: PostgreSQL connection string.
  - Docker (docker-compose in this repo): `postgresql://kobpay:kobpay_password@localhost:5433/kobpay?schema=public`
  - Local Postgres: update host/port/user/password to match your install.

## JWT Auth
- `JWT_ACCESS_SECRET`: Secret for access tokens.
- `JWT_REFRESH_SECRET`: Secret for refresh tokens.
- `JWT_ACCESS_TTL_SECONDS`: Default `900` (15 minutes).
- `JWT_REFRESH_TTL_SECONDS`: Default `2592000` (30 days).

## OTP Provider
- `OTP_PROVIDER`: `DEV` or `BULKSMS`.
- `DEV_OTP_FIXED_CODE`: Fixed OTP used in dev.
- `OTP_RATE_LIMIT_WINDOW_SECONDS`: Rate-limit window for OTP requests.
- `OTP_RATE_LIMIT_MAX_REQUESTS`: Max OTP requests per window.
- `BULKSMS_BASE_URL`: Sandbox default `https://www.bulksmsnigeria.com/api/sandbox/v2` (use production `https://www.bulksmsnigeria.com/api/v2`).
- `BULKSMS_API_TOKEN`: BulkSMS Nigeria API token.
- `BULKSMS_SENDER_ID`: Sender ID (max 11 characters).
- `BULKSMS_GATEWAY`: Optional gateway (`otp`, `direct-refund`, `direct-corporate`, `dual-backup`).
- `BULKSMS_FALLBACK_TO_DEV`: When true (and not in production), fallback to DEV OTP if BulkSMS fails.
- OTP endpoints are intended for signup only; login uses phone + password.

## Flutterwave (server-side only)
- `FLW_BASE_URL`: Defaults to `https://api.flutterwave.com`.
- `FLW_PUBLIC_KEY`: Public key from Flutterwave dashboard (client-side if needed).
- `FLW_SECRET_KEY`: Server secret key from Flutterwave dashboard.
- `FLW_WEBHOOK_SECRET`: Webhook secret for signature verification.
- `FLW_PAYMENT_REDIRECT_URL`: Redirect URL after Flutterwave checkout (HTTPS recommended in production).
- `FLW_PAYMENT_OPTIONS`: Comma-separated payment options for Flutterwave checkout.
- `FLW_CURRENCY`: Defaults to `NGN`.
- `FLW_COUNTRY`: Defaults to `NG`.

## Paystack (server-side only)
- `PAYSTACK_BASE_URL`: Defaults to `https://api.paystack.co`.
- `PAYSTACK_SECRET_KEY`: Paystack secret key (sk_test_ or sk_live_).
- `PAYSTACK_WEBHOOK_SECRET`: Webhook secret for signature verification.
- `PAYSTACK_DEDICATED_PROVIDER`: Dedicated account provider (default `wema-bank`).

## VTU Africa (server-side only)
- `VTU_API_KEY`: VTU Africa API key.
- `VTU_BASE_URL`: Defaults to `https://vtuafrica.com.ng/portal/api` (live).
- `VTU_MODE`: `sandbox` or `live` (optional, defaults to `live`).
- `VTU_WEBHOOK_URL`: Optional webhook URL override for VTU callbacks.
- `VTU_VERIFY_URL`: Defaults to `https://vtuafrica.com.ng/portal/api/merchant-verify/`.
- `VTU_DOCS_BASE_URL`: Defaults to `https://vtuafrica.com.ng/api` (used for catalog parsing).
- `VTU_CATALOG_CACHE_SECONDS`: Cache TTL for catalog lookups (default 3600).
- `VTU_HTTP_TIMEOUT_MS`: Timeout for VTU HTTP calls (default 15000).
Note: For sandbox, set `VTU_BASE_URL` to `https://vtuafrica.com.ng/portal/api-test`.

## Reeplay giftcards
- `REEPLAY_GIFTCARD_BASE_URL`: Base URL for Reeplay API.
- `REEPLAY_GIFTCARD_API_KEY`: API key for Reeplay.
- `REEPLAY_EMAIL`: Superadmin email for Reeplay.
- `REEPLAY_PASSWORD`: Superadmin password for Reeplay.
- `REEPLAY_LOGIN_PATH`: Defaults to `/superadmin/auth/login`.
- `REEPLAY_CREATE_CARD_PATH`: Defaults to `/superadmin/giftcard/generate/new`.

## SMTP (exchange receipts + support contact)
- `SMTP_HOST`: SMTP host (e.g., smtp.gmail.com).
- `SMTP_PORT`: SMTP port (587 or 465).
- `SMTP_USER`: SMTP username.
- `SMTP_PASS`: SMTP password or app password.
- `SMTP_FROM`: Email sender (default `KOBPAY <no-reply@kobpay.com>`).
- `ADMIN_RECEIPT_EMAIL`: Admin inbox for exchange receipt submissions and support messages.

## Admin (optional)
- `ADMIN_EMAIL`: Optional admin login email.
- `ADMIN_PASSWORD`: Optional admin password.
- `ADMIN_API_KEY`: Admin API key for exchange approvals (header: `x-admin-key`).

## Logging
- `LOG_LEVEL`: `debug` in dev (enables detailed bill request/response logs).

## Mobile API base URL
Configured in `mobile/lib/core/config/app_config.dart`:
- Android emulator: `http://10.0.2.2:4000`
- iOS simulator: `http://localhost:4000`
- Physical device: set to your LAN IP, e.g. `http://192.168.1.10:4000`

## Exchange FX rates
Edit `src/config/fxRates.ts` to update the manual NGN/EUR rates.

## Exchange pay-to details
Edit `src/config/exchangePayTo.ts` to update admin receiving bank details for NGN/EUR.
