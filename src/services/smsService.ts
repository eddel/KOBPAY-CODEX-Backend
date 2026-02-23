import { env } from "../config/env.js";
import { AppError } from "../errors.js";
import { logInfo, logWarn } from "../utils/logger.js";

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

const sendBulkSmsMessage = async (phone: string, message: string, reference?: string) => {
  if (!isBulkSmsConfigured()) {
    throw new AppError(501, "BulkSMS credentials missing", "SMS_PROVIDER_MISSING");
  }

  const baseUrl = env.BULKSMS_BASE_URL.trim().replace(/\/+$/, "");
  const url = `${baseUrl}/sms`;
  const payload: Record<string, string> = {
    from: env.BULKSMS_SENDER_ID.trim(),
    to: toBulkSmsNumber(phone),
    body: message,
    customer_reference:
      reference ?? `sms-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
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
    const messageError =
      body?.error?.message || body?.message || "BulkSMS SMS failed";
    throw new AppError(502, messageError, "BULKSMS_SMS_ERROR", body);
  }

  logInfo("sms_sent", {
    phone,
    messageId: body?.data?.message_id,
    gateway: body?.data?.gateway_used,
    sandbox: body?.data?.sandbox_mode
  });
};

export const sendSmsMessage = async (input: {
  phone: string;
  message: string;
  reference?: string;
}) => {
  if (!isBulkSmsConfigured()) {
    logWarn("sms_not_configured", { phone: input.phone });
    return;
  }

  await sendBulkSmsMessage(input.phone, input.message, input.reference);
};
