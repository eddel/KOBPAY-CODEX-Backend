import crypto from "crypto";
import { env } from "../config/env.js";
import { AppError } from "../errors.js";

type FlutterwaveResponse<T> = {
  status?: string;
  message?: string;
  data?: T;
};

type VirtualAccountInput = {
  userId: string;
  phone: string;
  name?: string | null;
  email: string;
  currency: string;
  isPermanent: boolean;
  amount: number;
  bvn?: string;
  nin?: string;
};

export type VirtualAccountResult = {
  accountNumber: string;
  bankName: string;
  accountName?: string;
  providerRef?: string;
  txRef: string;
  expiresAt?: string;
  raw?: unknown;
};

export type PaymentLinkInput = {
  userId: string;
  phone: string;
  name?: string | null;
  email: string;
  currency: string;
  amount: number;
  redirectUrl?: string;
  paymentOptions?: string;
};

export type PaymentLinkResult = {
  link: string;
  txRef: string;
  raw?: unknown;
};

export type FlutterwaveTransaction = {
  id?: number | string;
  flw_ref?: string;
  reference?: string;
  tx_ref?: string;
  status?: string;
  amount?: number | string;
  charged_amount?: number | string;
  currency?: string;
  app_fee?: number | string;
  fee?: number | string;
  meta?: Record<string, unknown>;
  meta_data?: Record<string, unknown>;
  customer?: Record<string, unknown>;
};

export const isFlutterwaveConfigured = () => {
  const secret = env.FLW_SECRET_KEY?.trim();
  if (!secret) {
    return false;
  }
  const lowered = secret.toLowerCase();
  if (lowered.includes("xxxx") || lowered.includes("change")) {
    return false;
  }
  return true;
};

const splitName = (name?: string | null) => {
  if (!name) {
    return { firstName: "Kobpay", lastName: "User" };
  }
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "User" };
  }
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
};

const buildTxRef = (userId: string) => `va_${userId}_${Date.now()}`;
const buildPaymentRef = (userId: string) => `wf_${userId}_${Date.now()}`;

const createMockVirtualAccount = (input: VirtualAccountInput): VirtualAccountResult => {
  const accountNumber = `700${Math.floor(100000000 + Math.random() * 900000000)}`;
  const expiresAt = input.isPermanent
    ? undefined
    : new Date(Date.now() + 60 * 60 * 1000).toISOString();
  return {
    accountNumber,
    bankName: "KOBPAY Mock Bank",
    accountName: input.name ?? "KOBPAY User",
    providerRef: `mock_${crypto.randomUUID()}`,
    txRef: buildTxRef(input.userId),
    expiresAt,
    raw: { mock: true }
  };
};

const createFlutterwaveVirtualAccount = async (
  input: VirtualAccountInput
): Promise<VirtualAccountResult> => {
  const { firstName, lastName } = splitName(input.name);
  const txRef = buildTxRef(input.userId);

  const payload: Record<string, unknown> = {
    email: input.email,
    tx_ref: txRef,
    currency: input.currency,
    amount: input.isPermanent ? 0 : input.amount,
    is_permanent: input.isPermanent,
    firstname: firstName,
    lastname: lastName,
    narration: `KOBPAY ${firstName} ${lastName}`.slice(0, 35),
    phonenumber: input.phone,
    meta_data: {
      userId: input.userId,
      source: "wallet_funding"
    }
  };

  if (input.isPermanent) {
    if (input.bvn) {
      payload.bvn = input.bvn;
    }
    if (input.nin) {
      payload.nin = input.nin;
    }
  }

  const url = new URL("/v3/virtual-account-numbers", env.FLW_BASE_URL).toString();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.FLW_SECRET_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(payload)
  });

  let body: any = null;
  try {
    body = await response.json();
  } catch (err) {
    throw new AppError(502, "Flutterwave response not JSON", "FLW_VA_ERROR", err);
  }

  if (!response.ok || body?.status !== "success") {
    throw new AppError(502, "Flutterwave virtual account failed", "FLW_VA_ERROR", body);
  }

  const data = body.data ?? {};
  const expiryRaw =
    data.expiry_date ?? data.expiration ?? data.expires_at ?? data.expired_at ?? null;
  let expiresAt: string | undefined;
  if (expiryRaw && String(expiryRaw).toLowerCase() !== "n/a") {
    const parsed = new Date(String(expiryRaw));
    expiresAt = Number.isNaN(parsed.getTime()) ? String(expiryRaw) : parsed.toISOString();
  }
  return {
    accountNumber: String(data.account_number ?? ""),
    bankName: String(data.bank_name ?? ""),
    accountName: data.account_name
      ? String(data.account_name)
      : data.note
        ? String(data.note)
        : undefined,
    providerRef: data.flw_ref ? String(data.flw_ref) : data.order_ref ? String(data.order_ref) : undefined,
    txRef,
    expiresAt,
    raw: body
  };
};

export const createVirtualAccount = async (
  input: VirtualAccountInput
): Promise<VirtualAccountResult> => {
  if (!isFlutterwaveConfigured()) {
    return createMockVirtualAccount(input);
  }

  if (!input.isPermanent && input.amount <= 0) {
    throw new AppError(400, "Amount must be greater than zero", "AMOUNT_REQUIRED");
  }

  if (input.isPermanent && input.currency.toUpperCase() === "NGN") {
    if (!input.bvn && !input.nin) {
      throw new AppError(
        400,
        "BVN or NIN is required for NGN static virtual accounts",
        "FLW_BVN_REQUIRED"
      );
    }
  }

  return createFlutterwaveVirtualAccount(input);
};

export const createPaymentLink = async (
  input: PaymentLinkInput
): Promise<PaymentLinkResult> => {
  if (!isFlutterwaveConfigured()) {
    throw new AppError(501, "Flutterwave not configured", "FLW_PAYMENT_MISSING");
  }

  const txRef = buildPaymentRef(input.userId);
  const payload: Record<string, unknown> = {
    tx_ref: txRef,
    amount: input.amount,
    currency: input.currency,
    ...(input.redirectUrl ? { redirect_url: input.redirectUrl } : {}),
    payment_options: input.paymentOptions ?? env.FLW_PAYMENT_OPTIONS,
    meta: {
      userId: input.userId,
      source: "wallet_funding"
    },
    customer: {
      email: input.email,
      phonenumber: input.phone,
      name: input.name ?? "KOBPAY User"
    },
    customizations: {
      title: "KOBPAY Wallet Funding",
      description: "Fund your wallet"
    }
  };

  const url = new URL("/v3/payments", env.FLW_BASE_URL).toString();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.FLW_SECRET_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(payload)
  });

  let body: any = null;
  try {
    body = await response.json();
  } catch (err) {
    throw new AppError(502, "Flutterwave response not JSON", "FLW_PAYMENT_ERROR", err);
  }

  if (!response.ok || body?.status !== "success") {
    console.error("Flutterwave payment link error", {
      status: response.status,
      body
    });
    throw new AppError(502, "Flutterwave payment link failed", "FLW_PAYMENT_ERROR", body);
  }

  const link = body?.data?.link ?? body?.data?.checkout_url ?? body?.data?.redirect_url;
  if (!link) {
    throw new AppError(502, "Flutterwave payment link missing", "FLW_PAYMENT_ERROR", body);
  }

  return {
    link: String(link),
    txRef,
    raw: body
  };
};

export const verifyTransactionByReference = async (
  txRef: string
): Promise<FlutterwaveTransaction> => {
  if (!isFlutterwaveConfigured()) {
    throw new AppError(501, "Flutterwave not configured", "FLW_PAYMENT_MISSING");
  }

  const url = new URL("/v3/transactions/verify_by_reference", env.FLW_BASE_URL);
  url.searchParams.set("tx_ref", txRef);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${env.FLW_SECRET_KEY}`,
      Accept: "application/json"
    }
  });

  let body: FlutterwaveResponse<FlutterwaveTransaction> | null = null;
  try {
    body = (await response.json()) as FlutterwaveResponse<FlutterwaveTransaction>;
  } catch (err) {
    throw new AppError(502, "Flutterwave response not JSON", "FLW_VERIFY_ERROR", err);
  }

  if (!response.ok || body?.status !== "success") {
    console.error("Flutterwave verify error", {
      status: response.status,
      body
    });
    throw new AppError(502, "Flutterwave verify failed", "FLW_VERIFY_ERROR", body);
  }

  return body.data ?? {};
};

