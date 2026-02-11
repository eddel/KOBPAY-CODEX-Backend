# Security Testing (PIN + Biometrics)

Manual curl examples for the security endpoints.

## Set PIN (initial)
```
curl -X POST http://localhost:4000/api/security/pin/set \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"pin":"1234"}'
```

## Request OTP for PIN change
```
curl -X POST http://localhost:4000/api/security/pin/change/request-otp \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

## Confirm PIN change
```
curl -X POST http://localhost:4000/api/security/pin/change/confirm \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"otpCode":"123456","newPin":"4321"}'
```

## Enable biometrics flag (server)
```
curl -X POST http://localhost:4000/api/security/biometrics/enable \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

## Disable biometrics flag (server)
```
curl -X POST http://localhost:4000/api/security/biometrics/disable \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```
