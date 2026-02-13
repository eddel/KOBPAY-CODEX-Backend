import { config as loadEnv } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

const envPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  ".env"
);
loadEnv({ path: envPath });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  API_BASE_URL: z.string().default("http://localhost:4000"),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().default(900),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().default(2592000),
  OTP_PROVIDER: z.enum(["DEV", "BULKSMS"]).default("DEV"),
  DEV_OTP_FIXED_CODE: z.string().default("123456"),
  OTP_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().default(600),
  OTP_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(3),
  BULKSMS_BASE_URL: z
    .string()
    .default("https://www.bulksmsnigeria.com/api/sandbox/v2"),
  BULKSMS_API_TOKEN: z.string().default(""),
  BULKSMS_SENDER_ID: z.string().default(""),
  BULKSMS_GATEWAY: z.string().default("otp"),
  BULKSMS_FALLBACK_TO_DEV: z.coerce.boolean().default(false),
  FLW_BASE_URL: z.string().default("https://api.flutterwave.com"),
  FLW_SECRET_KEY: z.string().default(""),
  FLW_WEBHOOK_SECRET: z.string().default(""),
  FLW_PAYMENT_REDIRECT_URL: z.string().default(""),
  FLW_PAYMENT_OPTIONS: z.string().default("card,banktransfer,ussd"),
  FLW_CURRENCY: z.string().default("NGN"),
  FLW_COUNTRY: z.string().default("NG"),
  VTU_API_KEY: z.string().default(""),
  VTU_BASE_URL: z.string().default("https://vtuafrica.com.ng/portal/api"),
  VTU_WEBHOOK_URL: z.string().default(""),
  VTU_MODE: z.enum(["sandbox", "live"]).default("live"),
  VTU_VERIFY_URL: z.string().default("https://vtuafrica.com.ng/portal/api/merchant-verify/"),
  VTU_DOCS_BASE_URL: z.string().default("https://vtuafrica.com.ng/api"),
  VTU_CATALOG_CACHE_SECONDS: z.coerce.number().default(3600),
  VTU_HTTP_TIMEOUT_MS: z.coerce.number().default(15000),
  DATA_SUBSCRIPTION_FEE_NGN: z.coerce.number().default(0),
  CABLE_SUBSCRIPTION_FEE_NGN: z.coerce.number().default(0),
  PAYSTACK_BASE_URL: z.string().default("https://api.paystack.co"),
  PAYSTACK_SECRET_KEY: z.string().default(""),
  PAYSTACK_WEBHOOK_SECRET: z.string().default(""),
  PAYSTACK_DEDICATED_PROVIDER: z.string().default("wema-bank"),
  REEPLAY_GIFTCARD_BASE_URL: z.string().default("https://example.reeplay.api"),
  REEPLAY_GIFTCARD_API_KEY: z.string().default(""),
  REEPLAY_EMAIL: z.string().default(""),
  REEPLAY_PASSWORD: z.string().default(""),
  REEPLAY_LOGIN_PATH: z.string().default("/superadmin/auth/login"),
  REEPLAY_CREATE_CARD_PATH: z.string().default("/superadmin/giftcard/generate/new"),
  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  SMTP_FROM: z.string().default("KOBPAY <no-reply@kobpay.com>"),
  ADMIN_RECEIPT_EMAIL: z.string().default("kobpayhq@gmail.com"),
  ADMIN_EMAIL: z.string().default("admin@kobpay.local"),
  ADMIN_PASSWORD: z.string().default("ChangeMe_StrongPassword"),
  ADMIN_API_KEY: z.string().default(""),
  LOG_LEVEL: z.string().default("debug"),
  CORS_ORIGIN: z.string().default("*")
});

export const env = envSchema.parse(process.env);
