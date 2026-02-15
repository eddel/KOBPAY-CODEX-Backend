import { env } from "../config/env.js";
import { AppError } from "../errors.js";
import { logDebug, logError } from "../utils/logger.js";

type FlutterwaveResponse<T> = {
  status?: string;
  message?: string;
  data?: T;
};

type RequestContext = {
  requestId?: string;
};

const buildUrl = (path: string, query?: Record<string, string | undefined>) => {
  const url = new URL(path, env.FLW_BASE_URL);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value) {
        url.searchParams.set(key, value);
      }
    });
  }
  return url.toString();
};

const flwRequest = async <T>(
  path: string,
  options: RequestInit = {},
  query?: Record<string, string | undefined>,
  ctx?: RequestContext
): Promise<FlutterwaveResponse<T>> => {
  const method = options.method ?? "GET";
  let bodyForLog: unknown = undefined;
  if (options.body && typeof options.body === "string") {
    try {
      bodyForLog = JSON.parse(options.body);
    } catch (_) {
      bodyForLog = options.body;
    }
  }

  logDebug("flutterwave_bills_request", {
    requestId: ctx?.requestId,
    method,
    path,
    query,
    body: bodyForLog
  });

  const response = await fetch(buildUrl(path, query), {
    ...options,
    headers: {
      Authorization: `Bearer ${env.FLW_SECRET_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers ?? {})
    }
  });

  let body: FlutterwaveResponse<T> | null = null;
  try {
    body = (await response.json()) as FlutterwaveResponse<T>;
  } catch (err) {
    throw new AppError(502, "Flutterwave response not JSON", "FLW_BILLS_ERROR", err);
  }

  logDebug("flutterwave_bills_response", {
    requestId: ctx?.requestId,
    status: response.status,
    body
  });

  if (!response.ok || body?.status !== "success") {
    logError("flutterwave_bills_error", {
      requestId: ctx?.requestId,
      status: response.status,
      body
    });
    throw new AppError(502, "Flutterwave bill API failed", "FLW_BILLS_ERROR", body);
  }

  return body;
};

export const getBillCategories = async (
  country = env.FLW_COUNTRY,
  ctx?: RequestContext
) => {
  const body = await flwRequest<Array<Record<string, unknown>>>(
    "/v3/top-bill-categories",
    { method: "GET" },
    { country },
    ctx
  );
  return body.data ?? [];
};

export const getBillers = async (
  category: string,
  country = env.FLW_COUNTRY,
  ctx?: RequestContext
) => {
  const body = await flwRequest<Array<Record<string, unknown>>>(
    `/v3/bills/${encodeURIComponent(category)}/billers`,
    { method: "GET" },
    { country },
    ctx
  );
  return body.data ?? [];
};

export const getBillItems = async (billerCode: string, ctx?: RequestContext) => {
  const body = await flwRequest<Array<Record<string, unknown>>>(
    `/v3/billers/${encodeURIComponent(billerCode)}/items`,
    { method: "GET" },
    undefined,
    ctx
  );
  return body.data ?? [];
};

export const validateBillCustomer = async (
  itemCode: string,
  billerCode: string,
  customer: string,
  ctx?: RequestContext
) => {
  const body = await flwRequest<Record<string, unknown>>(
    `/v3/bill-items/${encodeURIComponent(itemCode)}/validate`,
    { method: "GET" },
    { code: billerCode, customer },
    ctx
  );
  return body.data ?? {};
};

type BillPaymentInput = {
  billerCode: string;
  itemCode: string;
  customerId: string;
  amount: number;
  reference: string;
  type?: string;
  callbackUrl?: string;
  country?: string;
  idempotencyKey?: string;
  requestId?: string;
};

export const createBillPayment = async (input: BillPaymentInput) => {
  const body = await flwRequest<Record<string, unknown>>(
    `/v3/billers/${encodeURIComponent(input.billerCode)}/items/${encodeURIComponent(
      input.itemCode
    )}/payment`,
    {
      method: "POST",
      headers: input.idempotencyKey
        ? {
            "X-Idempotency-Key": input.idempotencyKey
          }
        : undefined,
      body: JSON.stringify({
        country: input.country ?? env.FLW_COUNTRY,
        customer_id: input.customerId,
        reference: input.reference,
        amount: input.amount,
        type: input.type,
        callback_url: input.callbackUrl
      })
    },
    undefined,
    { requestId: input.requestId }
  );
  return body.data ?? {};
};

export const getBillStatus = async (reference: string, ctx?: RequestContext) => {
  const body = await flwRequest<Record<string, unknown>>(
    `/v3/bills/${encodeURIComponent(reference)}`,
    { method: "GET" },
    undefined,
    ctx
  );
  return body.data ?? {};
};

