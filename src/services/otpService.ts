import { env } from "../config/env.js";
import { AppError } from "../errors.js";

const OTP_TTL_SECONDS = 300;

type OtpRecord = {
  code: string;
  expiresAt: number;
};

type RateLimitRecord = {
  count: number;
  windowStart: number;
};

type BulkSmsError = {
  message?: string;
  code?: string;
  description?: string;
};

type BulkSmsData = {
  message_id?: string;
  cost?: number;
  currency?: string;
  recipients_count?: number;
  gateway_used?: string;
  sandbox_mode?: boolean;
};

type BulkSmsResponse = {
  status?: string;
  code?: string;
  message?: string;
  data?: BulkSmsData;
  error?: BulkSmsError;
};

const otpStore = new Map<string, OtpRecord>();
const rateLimitStore = new Map<string, RateLimitRecord>();

const normalizePhone = (phone: string) => phone.trim();

const toBulkSmsNumber = (phone: string) => {
  const trimmed = phone.trim();
  const withoutSpaces = trimmed.replace(/\s+/g, "");
  const withoutPlus = withoutSpaces.startsWith("+")
    ? withoutSpaces.slice(1)
    : withoutSpaces;
  const digits = withoutPlus.replace(/\D/g, "");
  if (/^0\d{10}$/.test(digits)) {
    return `234${digits.slice(1)}`;
  }
  return digits;
};

const isRateLimited = (phone: string) => {
  const now = Date.now();
  const windowMs = env.OTP_RATE_LIMIT_WINDOW_SECONDS * 1000;
  const limit = env.OTP_RATE_LIMIT_MAX_REQUESTS;
  const existing = rateLimitStore.get(phone);

  if (!existing || now - existing.windowStart > windowMs) {
    rateLimitStore.set(phone, { count: 0, windowStart: now });
    return false;
  }

  return existing.count >= limit;
};

const incrementRateLimit = (phone: string) => {
  const now = Date.now();
  const existing = rateLimitStore.get(phone);
  if (!existing) {
    rateLimitStore.set(phone, { count: 1, windowStart: now });
    return;
  }

  existing.count += 1;
};

const generateRandomOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const isBulkSmsConfigured = () => {
  const apiToken = env.BULKSMS_API_TOKEN?.trim();
  const senderId = env.BULKSMS_SENDER_ID?.trim();
  if (!apiToken || !senderId) {
    return false;
  }

  const loweredToken = apiToken.toLowerCase();
  if (loweredToken.includes("xxxx") || loweredToken.includes("change")) {
    return false;
  }

  const loweredSender = senderId.toLowerCase();
  if (loweredSender.includes("your")) {
    return false;
  }

  return true;
};

const buildOtpMessage = (code: string) => {
  const ttlMinutes = Math.max(1, Math.round(OTP_TTL_SECONDS / 60));
  return `Your KOBPAY OTP is ${code}. It expires in ${ttlMinutes} minutes.`;
};

const sendBulkSms = async (phone: string, code: string) => {
  if (!isBulkSmsConfigured()) {
    throw new AppError(501, "BulkSMS credentials missing", "OTP_PROVIDER_MISSING");
  }

  const baseUrl = env.BULKSMS_BASE_URL.trim().replace(/\/+$/, "");
  const url = `${baseUrl}/sms`;
  const payload: Record<string, string> = {
    from: env.BULKSMS_SENDER_ID.trim(),
    to: toBulkSmsNumber(phone),
    body: buildOtpMessage(code),
    customer_reference: `otp-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
  };

  const gateway = env.BULKSMS_GATEWAY?.trim();
  if (gateway) {
    payload.gateway = gateway;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${env.BULKSMS_API_TOKEN.trim()}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new AppError(504, "BulkSMS SMS timed out", "BULKSMS_SMS_TIMEOUT", err);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  let body: BulkSmsResponse | null = null;
  try {
    body = (await response.json()) as BulkSmsResponse;
  } catch (err) {
    throw new AppError(502, "BulkSMS response not JSON", "BULKSMS_SMS_ERROR", err);
  }

  if (!response.ok || body?.status !== "success") {
    console.error("BulkSMS SMS error", {
      status: response.status,
      body
    });
    const message =
      body?.error?.message || body?.message || "BulkSMS SMS failed";
    throw new AppError(502, message, "BULKSMS_SMS_ERROR", body);
  }

  console.log("BulkSMS SMS response", {
    status: response.status,
    code: body?.code,
    messageId: body?.data?.message_id,
    sandbox: body?.data?.sandbox_mode,
    gateway: body?.data?.gateway_used
  });
};

export const requestOtp = async (phoneRaw: string) => {
  const phone = normalizePhone(phoneRaw);

  if (isRateLimited(phone)) {
    throw new AppError(429, "Too many OTP requests. Try again later.", "OTP_RATE_LIMIT");
  }

  incrementRateLimit(phone);

  if (env.OTP_PROVIDER !== "DEV" && env.OTP_PROVIDER !== "BULKSMS") {
    throw new AppError(501, "OTP provider not configured", "OTP_PROVIDER_MISSING");
  }

  let code = env.OTP_PROVIDER === "DEV" ? env.DEV_OTP_FIXED_CODE : generateRandomOtp();
  const expiresAt = Date.now() + OTP_TTL_SECONDS * 1000;

  otpStore.set(phone, { code, expiresAt });

  if (env.OTP_PROVIDER === "BULKSMS") {
    try {
      await sendBulkSms(phone, code);
    } catch (err) {
      const allowFallback = env.BULKSMS_FALLBACK_TO_DEV && env.NODE_ENV !== "production";
      if (!allowFallback) {
        otpStore.delete(phone);
        throw err;
      }

      console.warn("BulkSMS failed, falling back to DEV OTP", {
        phone
      });
      code = env.DEV_OTP_FIXED_CODE;
      otpStore.set(phone, { code, expiresAt });
    }
  }

  const allowFallback = env.BULKSMS_FALLBACK_TO_DEV && env.NODE_ENV !== "production";
  return {
    code:
      env.OTP_PROVIDER === "DEV" || (env.OTP_PROVIDER === "BULKSMS" && allowFallback)
        ? code
        : undefined,
    expiresAt: new Date(expiresAt).toISOString()
  };
};

export const verifyOtp = (phoneRaw: string, code: string) => {
  const phone = normalizePhone(phoneRaw);
  const record = otpStore.get(phone);

  if (!record) {
    return false;
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(phone);
    return false;
  }

  if (record.code !== code) {
    return false;
  }

  otpStore.delete(phone);
  return true;
};

