# Webhooks

This project currently supports Flutterwave webhooks at:

```
POST /api/webhooks/flutterwave
```

Paystack webhooks are supported at:

```
POST /api/webhooks/paystack
```

VTU Africa webhooks are supported at:

```
POST /api/webhooks/vtuafrica
```

## Signature verification
The backend validates one of the following headers when `FLW_WEBHOOK_SECRET` is set:

- `flutterwave-signature`: HMAC-SHA256 (base64) of the raw request body.
- `verif-hash`: legacy Flutterwave signature header (exact match).

For Paystack, the backend validates `x-paystack-signature` (HMAC-SHA512 hex) when
`PAYSTACK_WEBHOOK_SECRET` is set.

For VTU Africa, the backend compares the payload `apikey` (md5 hash) against the
md5 of `VTU_API_KEY` when present.

**Important:** The API server captures the raw request body to verify signatures.

## Sample payloads
These payloads are representative of the shapes the backend accepts. Fields may vary
based on Flutterwave response details.

### Wallet funding: `charge.completed`
```json
{
  "event": "charge.completed",
  "data": {
    "id": 123456789,
    "tx_ref": "va_<userId>_1700000000000",
    "flw_ref": "FLW-MOCK-REF",
    "status": "successful",
    "amount": 2500,
    "currency": "NGN",
    "app_fee": 20,
    "customer": {
      "name": "John Doe"
    },
    "meta": {
      "userId": "<userId>"
    }
  }
}
```

### Bill payment status: `singlebillpayment.status`
```json
{
  "event": "singlebillpayment.status",
  "data": {
    "status": "successful",
    "customer_reference": "bill_5a1b2c3d4e",
    "reference": "bill_5a1b2c3d4e",
    "amount": 1000,
    "currency": "NGN"
  }
}
```

### Transfer status: `transfer.status`
```json
{
  "event": "transfer.status",
  "data": {
    "id": 987654321,
    "reference": "wd_5a1b2c3d4e",
    "status": "successful",
    "amount": 1500,
    "currency": "NGN"
  }
}
```

### Paystack wallet funding: `charge.success`
```json
{
  "event": "charge.success",
  "data": {
    "id": 123456789,
    "reference": "psk_1234567890",
    "status": "success",
    "amount": 250000,
    "currency": "NGN",
    "fees": 1500,
    "customer": {
      "customer_code": "CUS_abc123"
    }
  }
}
```

### VTU Africa bill status webhook
```json
{
  "code": 101,
  "ref": "vtu_1234567890",
  "status": "Completed",
  "amount": "1000",
  "service": "mtn",
  "customerid": "080xxxxxxxx"
}
```

## Notes
- The backend uses `providerRef` (reference) for idempotency and to link webhooks to
  transactions.
- Failed bill/transfer webhooks will refund the wallet if the transaction was still
  marked pending.
