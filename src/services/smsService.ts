import { env } from "../config/env.js";
import { AppError } from "../errors.js";
import { logInfo, logWarn } from "../utils/logger.js";
import {
  getActiveSmsProvider,
  type SmsProvider
} from "./smsProviderSettings.js";

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

type TrackSendResponse = {
  status?: string;
  message?: string;
  data?: {
    id?: string;
    message_id?: string;
    common_id?: string;
    commonId?: string;
  };
  error?: {
    message?: string;
  };
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

export const getSmsProviderStatus = async () => {
  const activeProvider = await getActiveSmsProvider();
  return {
    activeProvider,
    providers: {
      DEV: { configured: true, senderId: "DEV" },
      BULKSMS: {
        configured: isBulkSmsConfigured(),
        senderId: env.BULKSMS_SENDER_ID.trim() || null
      },
      TRACKSEND: {
        configured: isTrackSendConfigured(),
        senderId: getTrackSendSenderId()
      }
    }
  };
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

const isTrackSendConfigured = () => {
  const apiToken = env.TRACKSEND_API_TOKEN?.trim();
  if (!apiToken) {
    return false;
  }

  const loweredToken = apiToken.toLowerCase();
  return !loweredToken.includes("xxxx") && !loweredToken.includes("change");
};

const getTrackSendSenderId = () => env.TRACKSEND_SENDER_ID.trim() || "Tracksend";

const normalizeTrackSendPhone = (phone: string) => {
  const trimmed = phone.trim().replace(/\s+/g, "");
  return trimmed.startsWith("+") ? trimmed.slice(1) : trimmed;
};

const parseJsonResponse = async <T>(response: Response, provider: string) => {
  try {
    return (await response.json()) as T;
  } catch (err) {
    throw new AppError(502, `${provider} response not JSON`, `${provider}_SMS_ERROR`, err);
  }
};

const sendTrackSendMessage = async (
  phone: string,
  message: string,
  reference?: string
) => {
  if (!isTrackSendConfigured()) {
    throw new AppError(501, "TrackSend credentials missing", "SMS_PROVIDER_MISSING");
  }

  const baseUrl = env.TRACKSEND_BASE_URL.trim().replace(/\/+$/, "");
  const url = `${baseUrl}/messaging/v1/sms`;
  const payload: Record<string, unknown> = {
    country_iso_code: env.TRACKSEND_COUNTRY_ISO_CODE.trim() || "NG",
    from: getTrackSendSenderId(),
    phone_numbers: [normalizeTrackSendPhone(phone)],
    text: message
  };

  const callbackUrl = env.TRACKSEND_CALLBACK_URL.trim();
  if (callbackUrl) {
    payload.callback_url = callbackUrl;
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
        Authorization: `Bearer ${env.TRACKSEND_API_TOKEN.trim()}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new AppError(504, "TrackSend SMS timed out", "TRACKSEND_SMS_TIMEOUT", err);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  const body = await parseJsonResponse<TrackSendResponse>(response, "TRACKSEND");
  const statusText = body?.status?.toLowerCase();
  const accepted =
    response.ok &&
    (!statusText || ["success", "queued", "ok"].includes(statusText));
  if (!accepted) {
    const messageError =
      body?.error?.message || body?.message || "TrackSend SMS failed";
    throw new AppError(502, messageError, "TRACKSEND_SMS_ERROR", body);
  }

  logInfo("sms_sent", {
    provider: "TRACKSEND",
    phone,
    reference,
    senderId: getTrackSendSenderId(),
    messageId: body?.data?.message_id ?? body?.data?.id,
    commonId: body?.data?.common_id ?? body?.data?.commonId
  });
};

const sendByProvider = async (
  provider: SmsProvider,
  phone: string,
  message: string,
  reference?: string
) => {
  if (provider === "BULKSMS") {
    await sendBulkSmsMessage(phone, message, reference);
    return;
  }

  if (provider === "TRACKSEND") {
    await sendTrackSendMessage(phone, message, reference);
  }
};

export const sendSmsMessage = async (input: {
  phone: string;
  message: string;
  reference?: string;
}) => {
  const provider = await getActiveSmsProvider();
  if (provider === "DEV") {
    logInfo("sms_dev_mode", { phone: input.phone, reference: input.reference });
    return;
  }

  try {
    await sendByProvider(provider, input.phone, input.message, input.reference);
  } catch (err) {
    logWarn("sms_send_failed", {
      provider,
      phone: input.phone,
      message: err instanceof Error ? err.message : String(err)
    });
    throw err;
  }
};
