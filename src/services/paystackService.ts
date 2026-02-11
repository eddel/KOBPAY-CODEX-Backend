import crypto from "crypto";
import { env } from "../config/env";
import { AppError } from "../errors";

type PaystackResponse<T> = {
  status?: boolean;
  message?: string;
  data?: T;
};

type PaystackCustomer = {
  id?: number;
  customer_code?: string;
  email?: string;
};

type PaystackDedicatedAccount = {
  id?: number;
  account_number?: string;
  account_name?: string;
  bank?: {
    name?: string;
  };
  assignment?: {
    account_number?: string;
    bank?: {
      name?: string;
    };
  };
  customer?: {
    customer_code?: string;
  };
};

export type PaystackCustomerResult = {
  customerId?: string;
  customerCode: string;
  raw?: unknown;
};

export type PaystackDedicatedAccountResult = {
  dedicatedAccountId?: string;
  accountNumber: string;
  bankName: string;
  accountName?: string;
  customerCode?: string;
  raw?: unknown;
};

export const isPaystackConfigured = () => {
  const secret = env.PAYSTACK_SECRET_KEY?.trim();
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
    return { firstName: "Kobpay", lastName: undefined };
  }
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: undefined };
  }
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
};

const createMockDedicatedAccount = (name?: string | null): PaystackDedicatedAccountResult => {
  const accountNumber = `901${Math.floor(100000000 + Math.random() * 900000000)}`;
  return {
    accountNumber,
    bankName: "KOBPAY Mock Bank",
    accountName: name ?? "KOBPAY",
    dedicatedAccountId: `mock_${crypto.randomUUID()}`,
    raw: { mock: true }
  };
};

const paystackFetch = async <T>(path: string, payload: unknown): Promise<T> => {
  const url = new URL(path, env.PAYSTACK_BASE_URL).toString();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(payload)
  });

  let body: PaystackResponse<T> | null = null;
  try {
    body = (await response.json()) as PaystackResponse<T>;
  } catch (err) {
    throw new AppError(502, "Paystack response not JSON", "PAYSTACK_ERROR", err);
  }

  if (!response.ok || !body?.status) {
    throw new AppError(502, "Paystack request failed", "PAYSTACK_ERROR", body);
  }

  return (body.data ?? {}) as T;
};

export const createPaystackCustomer = async (input: {
  email: string;
  name?: string | null;
  phone?: string | null;
  userId: string;
}): Promise<PaystackCustomerResult> => {
  if (!isPaystackConfigured()) {
    return {
      customerCode: `mock_${crypto.randomUUID()}`,
      raw: { mock: true }
    };
  }

  const { firstName, lastName } = splitName(input.name);
  const payload: Record<string, unknown> = {
    email: input.email,
    ...(firstName ? { first_name: firstName } : {}),
    ...(lastName ? { last_name: lastName } : {}),
    ...(input.phone ? { phone: input.phone } : {}),
    metadata: {
      userId: input.userId,
      source: "wallet_funding"
    }
  };

  const data = await paystackFetch<PaystackCustomer>("/customer", payload);
  const customerCode = String(data.customer_code ?? "");
  if (!customerCode) {
    throw new AppError(502, "Paystack customer code missing", "PAYSTACK_ERROR", data);
  }

  return {
    customerId: data.id ? String(data.id) : undefined,
    customerCode,
    raw: data
  };
};

export const createDedicatedAccount = async (input: {
  customerCode: string;
  preferredBank?: string | null;
  phone?: string | null;
  accountName?: string | null;
}): Promise<PaystackDedicatedAccountResult> => {
  if (!isPaystackConfigured()) {
    return createMockDedicatedAccount(input.accountName);
  }

  const payload = {
    customer: input.customerCode,
    preferred_bank: input.preferredBank ?? env.PAYSTACK_DEDICATED_PROVIDER,
    phone: input.phone ?? undefined
  };

  const data = await paystackFetch<PaystackDedicatedAccount>("/dedicated_account", payload);
  const accountNumber = String(
    data.account_number ?? data.assignment?.account_number ?? ""
  );
  const bankName = String(
    data.bank?.name ?? data.assignment?.bank?.name ?? ""
  );
  if (!accountNumber || !bankName) {
    throw new AppError(502, "Paystack dedicated account incomplete", "PAYSTACK_ERROR", data);
  }

  return {
    dedicatedAccountId: data.id ? String(data.id) : undefined,
    accountNumber,
    bankName,
    accountName: data.account_name ? String(data.account_name) : undefined,
    customerCode: data.customer?.customer_code,
    raw: data
  };
};
