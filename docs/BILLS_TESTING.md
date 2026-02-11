# Bills Testing (VTU Africa)

This guide helps you reproduce bill payments end-to-end using the KOBPAY API and
VTU Africa endpoints.

## Prerequisites
- Backend running locally on `API_BASE_URL` (default `http://localhost:4000`).
- Valid VTU Africa API key in `.env`.
- Wallet funded for the test user.

## Key Endpoints
- `GET /api/billers` (bill categories)
- `GET /api/billers?category=<category>` (billers by category)
- `GET /api/billers/:billerCode/plans` (items/plans)
- `POST /api/billers/pay` (initiate bill payment)
- `POST /api/bills/airtime/purchase` (airtime purchase via VTU Africa)
- `GET /api/bills/data/plans` (data plans via VTU Africa catalog)
- `POST /api/bills/data/purchase` (data purchase via VTU Africa)
- `GET /api/bills/cable/plans` (cable plans via VTU Africa catalog)
- `POST /api/bills/cable/verify` (cable smartcard verification)
- `POST /api/bills/cable/purchase` (cable purchase via VTU Africa)
- `GET /api/bills/electricity/providers` (electricity disco list)
- `POST /api/bills/electricity/verify` (electricity meter verification)
- `POST /api/bills/electricity/purchase` (electricity purchase)
- `GET /api/bills/betting/providers` (betting providers list)
- `POST /api/bills/betting/verify` (betting account verification)
- `POST /api/bills/betting/purchase` (betting funding)
- `POST /api/transactions/:id/refresh` (manual status refresh)

VTU Africa references:
- Airtime, data, cable TV, electricity, betting endpoints
- Merchant verification (cable/electricity/betting)
- Transaction status lookup

## Amounts
- **Backend + DB** use **kobo** internally.
- **API payloads** accept **NGN** (naira) for bill payments.
- **VTU Africa** expects **NGN** for bill payments.

## Scripts (local)
Run with `npx tsx` from the repo root.

### Airtime
```
$env:TEST_USER_PHONE="080..."
$env:TEST_USER_PASSWORD="YourPassword"
$env:TEST_AIRTIME_CUSTOMER="080..."
$env:TEST_AIRTIME_AMOUNT="100"
npx tsx scripts/testBillsAirtime.ts
```

### Electricity
```
$env:TEST_USER_PHONE="080..."
$env:TEST_USER_PASSWORD="YourPassword"
$env:TEST_ELECTRICITY_BILLER_CODE="ikeja-electric"
$env:TEST_ELECTRICITY_ITEM_CODE="prepaid"
$env:TEST_ELECTRICITY_CUSTOMER="MeterNumber"
$env:TEST_ELECTRICITY_AMOUNT="1000"
npx tsx scripts/testBillsElectricity.ts
```

## Sample Payloads
### Airtime
```json
{
  "billerCode": "mtn",
  "itemCode": "airtime",
  "customerId": "080xxxxxxxx",
  "amount": 100,
  "category": "airtime"
}
```

### Airtime (new VTU Africa endpoint)
```json
{
  "network": "mtn",
  "phone": "0803xxxxxxx",
  "amountNgn": 100,
  "pin": "1234",
  "clientRef": "air_demo_1700000000"
}
```

### Data
```json
{
  "billerCode": "mtn",
  "itemCode": "MTN SME 1GB",
  "customerId": "080xxxxxxxx",
  "amount": 500,
  "category": "data"
}
```

### Data (new VTU Africa endpoint)
```json
{
  "network": "mtn",
  "planId": "MTNSME:1000D",
  "phone": "0803xxxxxxx",
  "pin": "1234",
  "clientRef": "data_demo_1700000000"
}
```

### Cable TV
```json
{
  "billerCode": "dstv",
  "itemCode": "DSTV_Padi",
  "customerId": "SmartcardOrIUC",
  "amount": 4500,
  "category": "cabletv",
  "validate": true
}
```

### Cable TV (new VTU Africa endpoint)
```json
{
  "provider": "gotv",
  "planId": "gotv_jinja",
  "smartNo": "100221233",
  "pin": "1234",
  "clientRef": "cable_demo_1700000000"
}
```

### Cable TV Verify
```json
{
  "provider": "gotv",
  "planId": "gotv_jinja",
  "smartNo": "100221233"
}
```

### Electricity
```json
{
  "billerCode": "ikeja-electric",
  "itemCode": "prepaid",
  "customerId": "MeterNumber",
  "amount": 2000,
  "category": "electricity",
  "validate": true
}
```

### Electricity (new VTU Africa endpoint)
```json
{
  "serviceCode": "ikeja-electric",
  "meterNo": "100221233",
  "meterType": "prepaid",
  "amountNgn": 900,
  "pin": "1234",
  "clientRef": "elec_demo_1700000000"
}
```

### Electricity Verify
```json
{
  "serviceCode": "ikeja-electric",
  "meterNo": "100221233",
  "meterType": "prepaid"
}
```

### Betting Verify (new VTU Africa endpoint)
```json
{
  "provider": "bet9ja",
  "userId": "14446015"
}
```

### Betting Purchase (new VTU Africa endpoint)
```json
{
  "provider": "bet9ja",
  "userId": "14446015",
  "amountNgn": 500,
  "pin": "1234",
  "clientRef": "bet_demo_1700000000"
}
```

## Expected Responses
- `transaction.status` may be `pending` immediately after the pay call.
- Use `/api/transactions/:id/refresh` to finalize status.

## Airtime Purchase (curl)
```bash
curl -X POST http://localhost:4000/api/bills/airtime/purchase \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d "{\"network\":\"mtn\",\"phone\":\"0803xxxxxxx\",\"amountNgn\":100,\"pin\":\"1234\"}"
```

Expected (success) response excerpt:
```json
{
  "ok": true,
  "transaction": {
    "status": "success",
    "provider": "vtuafrica"
  },
  "provider": {
    "code": 101,
    "description": {
      "Status": "Completed"
    }
  }
}
```

## Data Plans (curl)
```bash
curl -X GET http://localhost:4000/api/bills/data/plans \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

## Data Purchase (curl)
```bash
curl -X POST http://localhost:4000/api/bills/data/purchase \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d "{\"network\":\"mtn\",\"planId\":\"MTNSME:1000D\",\"phone\":\"0803xxxxxxx\",\"pin\":\"1234\"}"
```

## Cable Plans (curl)
```bash
curl -X GET http://localhost:4000/api/bills/cable/plans \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

## Cable Purchase (curl)
```bash
curl -X POST http://localhost:4000/api/bills/cable/purchase \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d "{\"provider\":\"gotv\",\"planId\":\"gotv_jinja\",\"smartNo\":\"100221233\",\"pin\":\"1234\"}"
```

## Cable Verify (curl)
```bash
curl -X POST http://localhost:4000/api/bills/cable/verify \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d "{\"provider\":\"gotv\",\"planId\":\"gotv_jinja\",\"smartNo\":\"100221233\"}"
```

## Electricity Providers (curl)
```bash
curl -X GET http://localhost:4000/api/bills/electricity/providers \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

## Electricity Purchase (curl)
```bash
curl -X POST http://localhost:4000/api/bills/electricity/purchase \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d "{\"serviceCode\":\"ikeja-electric\",\"meterNo\":\"100221233\",\"meterType\":\"prepaid\",\"amountNgn\":900,\"pin\":\"1234\"}"
```

## Electricity Verify (curl)
```bash
curl -X POST http://localhost:4000/api/bills/electricity/verify \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d "{\"serviceCode\":\"ikeja-electric\",\"meterNo\":\"100221233\",\"meterType\":\"prepaid\"}"
```

Expected success response excerpt:
```json
{
  "ok": true,
  "receipt": {
    "token": "2345786765",
    "meterNo": "100221233",
    "meterType": "prepaid"
  }
}
```

## Betting Providers (curl)
```bash
curl -X GET http://localhost:4000/api/bills/betting/providers \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

## Betting Verify (curl)
```bash
curl -X POST http://localhost:4000/api/bills/betting/verify \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d "{\"provider\":\"bet9ja\",\"userId\":\"14446015\"}"
```

## Betting Purchase (curl)
```bash
curl -X POST http://localhost:4000/api/bills/betting/purchase \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d "{\"provider\":\"bet9ja\",\"userId\":\"14446015\",\"amountNgn\":500,\"pin\":\"1234\"}"
```

## Common Errors (What to Check)
- `VTU_BILLS_ERROR`: VTU Africa responded with non-success status. Check backend logs for the exact response.
- `VTU_VALIDATE_ERROR`: VTU validation failed. Check the customer details and service code.
- `AMOUNT_MISMATCH`: Amount doesn’t match the selected plan’s fixed price.
- `INSUFFICIENT_FUNDS`: Wallet balance is too low.
- `PIN_REQUIRED` / `PIN_INVALID`: User PIN required for bill payment.

## Debugging Tips
- Set `LOG_LEVEL=debug` in `.env` to log request/response payloads.
- Backend logs include `requestId` for each bill flow.
