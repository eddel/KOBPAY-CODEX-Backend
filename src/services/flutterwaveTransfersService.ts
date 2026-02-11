import { env } from "../config/env";
import { AppError } from "../errors";
import { isFlutterwaveConfigured } from "./flutterwaveService";

type FlutterwaveResponse<T> = {
  status?: string;
  message?: string;
  data?: T;
};

const buildUrl = (path: string) => new URL(path, env.FLW_BASE_URL).toString();

const flwRequest = async <T>(
  path: string,
  options: RequestInit = {}
): Promise<FlutterwaveResponse<T>> => {
  const response = await fetch(buildUrl(path), {
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
    throw new AppError(502, "Flutterwave response not JSON", "FLW_TRANSFER_ERROR", err);
  }

  if (!response.ok || body?.status !== "success") {
    throw new AppError(502, "Flutterwave transfer API failed", "FLW_TRANSFER_ERROR", body);
  }

  return body;
};

export type BankInfo = {
  name?: string;
  bank_name?: string;
  code?: string;
  bank_code?: string;
  id?: string | number;
};

export const listBanks = async (country: string) => {
  if (!isFlutterwaveConfigured()) {
    return [
      { name: "Mock Bank", code: "999" },
      { name: "Demo Bank", code: "998" }
    ];
  }
  const body = await flwRequest<BankInfo[]>(`/v3/banks/${country}`, { method: "GET" });
  return body.data ?? [];
};

export const resolveBankAccount = async (accountNumber: string, bankCode: string) => {
  if (!isFlutterwaveConfigured()) {
    return {
      account_number: accountNumber,
      account_name: "MOCK ACCOUNT"
    };
  }

  const body = await flwRequest<{
    account_number: string;
    account_name: string;
  }>(`/v3/accounts/resolve`, {
    method: "POST",
    body: JSON.stringify({
      account_number: accountNumber,
      account_bank: bankCode
    })
  });

  return body.data;
};

type TransferInput = {
  amount: number;
  currency: string;
  accountBank: string;
  accountNumber: string;
  narration?: string;
  reference: string;
  meta?: Record<string, unknown>;
  idempotencyKey?: string;
};

export const createTransfer = async (input: TransferInput) => {
  if (!isFlutterwaveConfigured()) {
    return {
      id: `mock_${input.reference}`,
      status: "NEW",
      amount: input.amount,
      currency: input.currency,
      reference: input.reference
    };
  }

  const body = await flwRequest<Record<string, unknown>>(`/v3/transfers`, {
    method: "POST",
    headers: input.idempotencyKey
      ? {
          "X-Idempotency-Key": input.idempotencyKey
        }
      : undefined,
    body: JSON.stringify({
      account_bank: input.accountBank,
      account_number: input.accountNumber,
      amount: input.amount,
      currency: input.currency,
      narration: input.narration,
      reference: input.reference,
      meta: input.meta
    })
  });

  return body.data ?? {};
};
