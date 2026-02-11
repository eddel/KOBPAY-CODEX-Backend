import { env } from "../config/env";
import { AppError } from "../errors";

type ReeplayAuth = {
  token: string;
  expiresAt?: number;
};

type ReeplayResponse<T> = {
  status?: string;
  message?: string;
  data?: T;
  token?: string;
  access_token?: string;
  accessToken?: string;
  expires_in?: number;
  expiresIn?: number;
};

let cachedAuth: ReeplayAuth | null = null;

const buildUrl = (path: string) => {
  const base = env.REEPLAY_GIFTCARD_BASE_URL.endsWith("/")
    ? env.REEPLAY_GIFTCARD_BASE_URL
    : `${env.REEPLAY_GIFTCARD_BASE_URL}/`;
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  return new URL(normalizedPath, base).toString();
};

const extractToken = (body: ReeplayResponse<any>) =>
  body?.token ??
  body?.access_token ??
  body?.accessToken ??
  (body?.data as any)?.token ??
  (body?.data as any)?.access_token ??
  (body?.data as any)?.accessToken ??
  null;

const extractExpirySeconds = (body: ReeplayResponse<any>) =>
  body?.expires_in ??
  body?.expiresIn ??
  (body?.data as any)?.expires_in ??
  (body?.data as any)?.expiresIn ??
  null;

const isAuthValid = (auth: ReeplayAuth | null) => {
  if (!auth) {
    return false;
  }
  if (!auth.expiresAt) {
    return true;
  }
  return Date.now() < auth.expiresAt - 30_000;
};

const login = async () => {
  if (!env.REEPLAY_EMAIL || !env.REEPLAY_PASSWORD) {
    throw new AppError(501, "Reeplay credentials not configured", "REEPLAY_CONFIG");
  }

  const response = await fetch(buildUrl(env.REEPLAY_LOGIN_PATH), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      email: env.REEPLAY_EMAIL,
      password: env.REEPLAY_PASSWORD
    })
  });

  let body: ReeplayResponse<any> | null = null;
  try {
    body = (await response.json()) as ReeplayResponse<any>;
  } catch (err) {
    throw new AppError(502, "Reeplay response not JSON", "REEPLAY_AUTH_ERROR", err);
  }

  if (!response.ok) {
    throw new AppError(502, "Reeplay authentication failed", "REEPLAY_AUTH_ERROR", body);
  }

  const token = extractToken(body);
  if (!token) {
    throw new AppError(502, "Reeplay token missing", "REEPLAY_AUTH_ERROR", body);
  }

  const expiresIn = extractExpirySeconds(body);
  cachedAuth = {
    token,
    expiresAt: expiresIn ? Date.now() + Number(expiresIn) * 1000 : undefined
  };
};

const ensureAuth = async () => {
  if (!isAuthValid(cachedAuth)) {
    await login();
  }
  return cachedAuth!;
};

type CreateCardInput = {
  amount: number;
  currency?: string;
  recipientEmail?: string;
  note?: string;
  reference: string;
};

export const createReeplayCard = async (input: CreateCardInput) => {
  const auth = await ensureAuth();

  const payload: Record<string, unknown> = {
    amount: String(input.amount),
    currency: input.currency ?? "NGN"
  };

  const response = await fetch(buildUrl(env.REEPLAY_CREATE_CARD_PATH), {
    method: "POST",
    headers: {
      "superadmin-auth": auth.token,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(payload)
  });

  let body: ReeplayResponse<any> | null = null;
  try {
    body = (await response.json()) as ReeplayResponse<any>;
  } catch (err) {
    throw new AppError(502, "Reeplay response not JSON", "REEPLAY_CARD_ERROR", err);
  }

  if (!response.ok) {
    throw new AppError(502, "Reeplay giftcard creation failed", "REEPLAY_CARD_ERROR", body);
  }

  return body?.data ?? body;
};
