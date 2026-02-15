import { env } from "../config/env.js";
import { AppError } from "../errors.js";
import { logDebug, logError } from "../utils/logger.js";

type RequestContext = {
  requestId?: string;
};

type VtuResponse<T = unknown> = {
  code?: number;
  description?: T;
  message?: string;
  status?: string;
};

type AirtimeInput = {
  network: "mtn" | "airtel" | "glo" | "9mobile";
  phone: string;
  amount: number;
  ref: string;
  webhookURL?: string;
};

type DataInput = {
  service: string;
  mobileNumber: string;
  dataPlan: string;
  ref: string;
  maxamount?: string | number;
  webhookURL?: string;
};

type PayTvInput = {
  service: string;
  smartNo: string;
  variation: string;
  ref: string;
  maxamount?: string | number;
  webhookURL?: string;
};

type ElectricityInput = {
  service: string;
  meterNo: string;
  meterType: "prepaid" | "postpaid";
  amount: number;
  ref: string;
  webhookURL?: string;
};

type VerifyMerchantInput = {
  serviceName: string;
  service: string;
  userid: string;
};

type VerifyCableInput = {
  service: string;
  smartNo: string;
  variation: string;
};

type VerifyElectricityInput = {
  service: string;
  meterNo: string;
  meterType: "prepaid" | "postpaid";
};

type FundBetInput = {
  service: string;
  userid: string;
  amount: number;
  ref: string;
  phone?: string;
  webhookURL?: string;
};

const merchantVerifyRequest = async (
  params: Record<string, string | number | undefined>,
  ctx?: RequestContext,
  logKey = "vtu_merchant_verify"
): Promise<VtuResponse<Record<string, unknown>>> => {
  if (!env.VTU_API_KEY || !env.VTU_API_KEY.trim()) {
    throw new AppError(501, "VTU API key missing", "VTU_MISSING");
  }
  ensureLiveBase();

  const url = buildUrl(env.VTU_BASE_URL, "merchant-verify/", {
    apikey: env.VTU_API_KEY,
    ...params
  });

  logDebug(`${logKey}_request`, {
    requestId: ctx?.requestId,
    url: redactUrl(url)
  });

  let response: Response;
  try {
    response = await fetchWithTimeout(url, { method: "GET" });
  } catch (err) {
    throw new AppError(504, "VTU request timed out", "VTU_TIMEOUT", err);
  }

  let body: VtuResponse<Record<string, unknown>> | null = null;
  try {
    body = (await response.json()) as VtuResponse<Record<string, unknown>>;
  } catch (err) {
    throw new AppError(502, "VTU response not JSON", "VTU_ERROR", err);
  }

  logDebug(`${logKey}_response`, {
    requestId: ctx?.requestId,
    status: response.status,
    body
  });

  if (!response.ok) {
    logError(`${logKey}_http_error`, {
      requestId: ctx?.requestId,
      status: response.status,
      body
    });
    throw new AppError(502, "VTU merchant verify failed", "VTU_ERROR", body);
  }

  return body ?? {};
};

const normalizeVerifyResponse = (
  body: VtuResponse<Record<string, unknown>>,
  fallbackUser?: string
) => {
  const description = (body?.description ?? {}) as any;
  const status =
    typeof description === "string"
      ? description
      : String(description?.Status ?? description?.status ?? "");
  const ok = Number(body?.code ?? 0) === 101 && status.toLowerCase().includes("completed");
  let customerName =
    description?.Customer ??
    description?.customer ??
    description?.CustomerName ??
    description?.customerName ??
    description?.Name ??
    description?.name;
  if (!customerName && description && typeof description === "object") {
    const match = Object.entries(description).find(
      ([key, value]) =>
        /customer|name/i.test(key) &&
        !/product|service/i.test(key) &&
        typeof value === "string" &&
        value.trim().length > 0
    );
    if (match) {
      customerName = match[1];
    }
  }

  return {
    ok,
    code: Number(body?.code ?? 0),
    status,
    customerName: customerName ? String(customerName) : undefined,
    userid:
      description?.UserID ??
      description?.userid ??
      description?.UserId ??
      fallbackUser,
    service: description?.Service ?? description?.service,
    raw: body ?? {}
  };
};

const buildUrl = (base: string, path: string, params: Record<string, string | number | undefined>) => {
  const url = new URL(path.replace(/^\//, ""), base.endsWith("/") ? base : `${base}/`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).length) {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
};

const fetchWithTimeout = async (url: string, options: RequestInit = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.VTU_HTTP_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
};

const redactUrl = (url: string) => {
  const parsed = new URL(url);
  parsed.searchParams.delete("apikey");
  return parsed.toString();
};

const ensureLiveBase = () => {
  if (env.VTU_BASE_URL.includes("api-test")) {
    throw new AppError(500, "VTU live base URL required for data", "VTU_LIVE_REQUIRED");
  }
};

export const purchaseAirtime = async (
  input: AirtimeInput,
  ctx?: RequestContext
): Promise<VtuResponse<Record<string, unknown>>> => {
  if (!env.VTU_API_KEY || !env.VTU_API_KEY.trim()) {
    throw new AppError(501, "VTU API key missing", "VTU_MISSING");
  }

  const url = buildUrl(env.VTU_BASE_URL, "airtime/", {
    apikey: env.VTU_API_KEY,
    network: input.network,
    phone: input.phone,
    amount: input.amount,
    ref: input.ref,
    webhookURL: input.webhookURL
  });

  logDebug("vtu_airtime_request", {
    requestId: ctx?.requestId,
    url: redactUrl(url)
  });

  let response: Response;
  try {
    response = await fetchWithTimeout(url, { method: "GET" });
  } catch (err) {
    throw new AppError(504, "VTU request timed out", "VTU_TIMEOUT", err);
  }

  let body: VtuResponse<Record<string, unknown>> | null = null;
  try {
    body = (await response.json()) as VtuResponse<Record<string, unknown>>;
  } catch (err) {
    throw new AppError(502, "VTU response not JSON", "VTU_ERROR", err);
  }

  logDebug("vtu_airtime_response", {
    requestId: ctx?.requestId,
    status: response.status,
    body
  });

  if (!response.ok) {
    logError("vtu_airtime_http_error", {
      requestId: ctx?.requestId,
      status: response.status,
      body
    });
    throw new AppError(502, "VTU airtime request failed", "VTU_ERROR", body);
  }

  return body ?? {};
};

export const purchaseData = async (
  input: DataInput,
  ctx?: RequestContext
): Promise<VtuResponse<Record<string, unknown>>> => {
  if (!env.VTU_API_KEY || !env.VTU_API_KEY.trim()) {
    throw new AppError(501, "VTU API key missing", "VTU_MISSING");
  }
  ensureLiveBase();

  const url = buildUrl(env.VTU_BASE_URL, "data/", {
    apikey: env.VTU_API_KEY,
    service: input.service,
    MobileNumber: input.mobileNumber,
    DataPlan: input.dataPlan,
    ref: input.ref,
    maxamount: input.maxamount,
    webhookURL: input.webhookURL
  });

  logDebug("vtu_data_request", {
    requestId: ctx?.requestId,
    url: redactUrl(url)
  });

  let response: Response;
  try {
    response = await fetchWithTimeout(url, { method: "GET" });
  } catch (err) {
    throw new AppError(504, "VTU request timed out", "VTU_TIMEOUT", err);
  }

  let body: VtuResponse<Record<string, unknown>> | null = null;
  try {
    body = (await response.json()) as VtuResponse<Record<string, unknown>>;
  } catch (err) {
    throw new AppError(502, "VTU response not JSON", "VTU_ERROR", err);
  }

  logDebug("vtu_data_response", {
    requestId: ctx?.requestId,
    status: response.status,
    body
  });

  if (!response.ok) {
    logError("vtu_data_http_error", {
      requestId: ctx?.requestId,
      status: response.status,
      body
    });
    throw new AppError(502, "VTU data request failed", "VTU_ERROR", body);
  }

  return body ?? {};
};

export const purchasePayTv = async (
  input: PayTvInput,
  ctx?: RequestContext
): Promise<VtuResponse<Record<string, unknown>>> => {
  if (!env.VTU_API_KEY || !env.VTU_API_KEY.trim()) {
    throw new AppError(501, "VTU API key missing", "VTU_MISSING");
  }
  ensureLiveBase();

  const url = buildUrl(env.VTU_BASE_URL, "paytv/", {
    apikey: env.VTU_API_KEY,
    service: input.service,
    smartNo: input.smartNo,
    variation: input.variation,
    ref: input.ref,
    maxamount: input.maxamount,
    webhookURL: input.webhookURL
  });

  logDebug("vtu_paytv_request", {
    requestId: ctx?.requestId,
    url: redactUrl(url)
  });

  let response: Response;
  try {
    response = await fetchWithTimeout(url, { method: "GET" });
  } catch (err) {
    throw new AppError(504, "VTU request timed out", "VTU_TIMEOUT", err);
  }

  let body: VtuResponse<Record<string, unknown>> | null = null;
  try {
    body = (await response.json()) as VtuResponse<Record<string, unknown>>;
  } catch (err) {
    throw new AppError(502, "VTU response not JSON", "VTU_ERROR", err);
  }

  logDebug("vtu_paytv_response", {
    requestId: ctx?.requestId,
    status: response.status,
    body
  });

  if (!response.ok) {
    logError("vtu_paytv_http_error", {
      requestId: ctx?.requestId,
      status: response.status,
      body
    });
    throw new AppError(502, "VTU paytv request failed", "VTU_ERROR", body);
  }

  return body ?? {};
};

export const purchaseElectricity = async (
  input: ElectricityInput,
  ctx?: RequestContext
): Promise<VtuResponse<Record<string, unknown>>> => {
  if (!env.VTU_API_KEY || !env.VTU_API_KEY.trim()) {
    throw new AppError(501, "VTU API key missing", "VTU_MISSING");
  }
  ensureLiveBase();

  const url = buildUrl(env.VTU_BASE_URL, "electric/", {
    apikey: env.VTU_API_KEY,
    service: input.service,
    meterNo: input.meterNo,
    metertype: input.meterType,
    amount: input.amount,
    ref: input.ref,
    webhookURL: input.webhookURL
  });

  logDebug("vtu_electric_request", {
    requestId: ctx?.requestId,
    url: redactUrl(url)
  });

  let response: Response;
  try {
    response = await fetchWithTimeout(url, { method: "GET" });
  } catch (err) {
    throw new AppError(504, "VTU request timed out", "VTU_TIMEOUT", err);
  }

  let body: VtuResponse<Record<string, unknown>> | null = null;
  try {
    body = (await response.json()) as VtuResponse<Record<string, unknown>>;
  } catch (err) {
    throw new AppError(502, "VTU response not JSON", "VTU_ERROR", err);
  }

  logDebug("vtu_electric_response", {
    requestId: ctx?.requestId,
    status: response.status,
    body
  });

  if (!response.ok) {
    logError("vtu_electric_http_error", {
      requestId: ctx?.requestId,
      status: response.status,
      body
    });
    throw new AppError(502, "VTU electricity request failed", "VTU_ERROR", body);
  }

  return body ?? {};
};

export const verifyMerchantAccount = async (
  input: VerifyMerchantInput,
  ctx?: RequestContext
): Promise<{
  ok: boolean;
  code: number;
  status: string;
  customerName?: string;
  userid?: string;
  service?: string;
  raw: VtuResponse<Record<string, unknown>>;
}> => {
  const body = await merchantVerifyRequest(
    {
      serviceName: input.serviceName,
      service: input.service,
      userid: input.userid
    },
    ctx
  );

  return normalizeVerifyResponse(body, input.userid);
};

export const verifyCableAccount = async (
  input: VerifyCableInput,
  ctx?: RequestContext
) =>
  normalizeVerifyResponse(
    await merchantVerifyRequest(
      {
        serviceName: "CableTV",
        service: input.service,
        smartNo: input.smartNo,
        variation: input.variation
      },
      ctx,
      "vtu_cable_verify"
    )
  );

export const verifyElectricityAccount = async (
  input: VerifyElectricityInput,
  ctx?: RequestContext
) =>
  normalizeVerifyResponse(
    await merchantVerifyRequest(
      {
        serviceName: "Electricity",
        service: input.service,
        meterNo: input.meterNo,
        metertype: input.meterType
      },
      ctx,
      "vtu_electric_verify"
    )
  );

export const fundBetAccount = async (
  input: FundBetInput,
  ctx?: RequestContext
): Promise<VtuResponse<Record<string, unknown>>> => {
  if (!env.VTU_API_KEY || !env.VTU_API_KEY.trim()) {
    throw new AppError(501, "VTU API key missing", "VTU_MISSING");
  }
  ensureLiveBase();

  const url = buildUrl(env.VTU_BASE_URL, "betpay", {
    apikey: env.VTU_API_KEY,
    service: input.service,
    userid: input.userid,
    amount: input.amount,
    ref: input.ref,
    phone: input.phone,
    webhookURL: input.webhookURL
  });

  logDebug("vtu_betpay_request", {
    requestId: ctx?.requestId,
    url: redactUrl(url)
  });

  let response: Response;
  try {
    response = await fetchWithTimeout(url, { method: "GET" });
  } catch (err) {
    throw new AppError(504, "VTU request timed out", "VTU_TIMEOUT", err);
  }

  let body: VtuResponse<Record<string, unknown>> | null = null;
  try {
    body = (await response.json()) as VtuResponse<Record<string, unknown>>;
  } catch (err) {
    throw new AppError(502, "VTU response not JSON", "VTU_ERROR", err);
  }

  logDebug("vtu_betpay_response", {
    requestId: ctx?.requestId,
    status: response.status,
    body
  });

  if (!response.ok) {
    logError("vtu_betpay_http_error", {
      requestId: ctx?.requestId,
      status: response.status,
      body
    });
    throw new AppError(502, "VTU betpay request failed", "VTU_ERROR", body);
  }

  return body ?? {};
};

