import crypto from "crypto";
import { env } from "../config/env";
import { AppError } from "../errors";
import { logDebug, logError, logWarn } from "../utils/logger";

type RequestContext = {
  requestId?: string;
};

type VtuResponse<T = unknown> = {
  code?: number;
  description?: T;
  message?: string;
  status?: string;
};

type CatalogEntry<T> = {
  fetchedAt: number;
  data: T;
  inFlight: Promise<void> | null;
};

type VtuService = {
  code: string;
  name: string;
};

type VtuPlan = {
  service: string;
  code: string;
  name?: string;
  amount?: number;
  status?: string;
};

const normalizeText = (value: string) =>
  value.replace(/\s+/g, " ").replace(/\u00a0/g, " ").trim();

const decodeHtml = (value: string) =>
  value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'");

const stripTags = (value: string) =>
  normalizeText(decodeHtml(value.replace(/<[^>]*>/g, " ")));

const extractLinks = (html: string, baseUrl: string) => {
  const links = html.match(/href=["']([^"']+)["']/gi) ?? [];
  const results = new Set<string>();
  links.forEach((link) => {
    const match = link.match(/href=["']([^"']+)["']/i);
    if (!match) return;
    const href = match[1];
    if (!href || href.startsWith("#")) return;
    try {
      const resolved = new URL(href, baseUrl).toString();
      results.add(resolved);
    } catch (_) {
      return;
    }
  });
  return Array.from(results.values());
};

const extractTables = (html: string) => {
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
  return tables.map((table) => {
    const rows = table.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
    return rows.map((row) => {
      const cells = row.match(/<(?:td|th)[\s\S]*?>[\s\S]*?<\/(?:td|th)>/gi) ?? [];
      return cells.map((cell) => stripTags(cell));
    });
  });
};

const tryNumber = (value?: string) => {
  if (!value) return undefined;
  const numeric = value.replace(/[^\d.]/g, "");
  if (!numeric) return undefined;
  const parsed = Number(numeric);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const getBase = (base: string) => (base.endsWith("/") ? base : `${base}/`);

const buildUrl = (base: string, path: string, params: Record<string, string | number | undefined>) => {
  const url = new URL(path.replace(/^\//, ""), getBase(base));
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

const vtuRequest = async <T>(
  path: string,
  params: Record<string, string | number | undefined>,
  ctx?: RequestContext
): Promise<VtuResponse<T>> => {
  if (!env.VTU_API_KEY || !env.VTU_API_KEY.trim()) {
    throw new AppError(501, "VTU API key missing", "VTU_MISSING");
  }
  const url = buildUrl(env.VTU_BASE_URL, path, {
    apikey: env.VTU_API_KEY,
    ...params
  });

  logDebug("vtu_request", {
    requestId: ctx?.requestId,
    url
  });

  let response: Response;
  try {
    response = await fetchWithTimeout(url, { method: "GET" });
  } catch (err) {
    throw new AppError(504, "VTU request timed out", "VTU_TIMEOUT", err);
  }
  let body: VtuResponse<T> | null = null;
  try {
    body = (await response.json()) as VtuResponse<T>;
  } catch (err) {
    throw new AppError(502, "VTU response not JSON", "VTU_ERROR", err);
  }

  logDebug("vtu_response", {
    requestId: ctx?.requestId,
    status: response.status,
    body
  });

  if (!response.ok) {
    logError("vtu_http_error", { requestId: ctx?.requestId, status: response.status, body });
    throw new AppError(502, "VTU request failed", "VTU_ERROR", body);
  }

  return body ?? {};
};

const vtuVerify = async <T>(
  params: Record<string, string | number | undefined>,
  ctx?: RequestContext
): Promise<VtuResponse<T>> => {
  if (!env.VTU_API_KEY || !env.VTU_API_KEY.trim()) {
    throw new AppError(501, "VTU API key missing", "VTU_MISSING");
  }
  const url = buildUrl(env.VTU_VERIFY_URL, "", {
    apikey: env.VTU_API_KEY,
    ...params
  });

  logDebug("vtu_verify_request", {
    requestId: ctx?.requestId,
    url
  });

  let response: Response;
  try {
    response = await fetchWithTimeout(url, { method: "GET" });
  } catch (err) {
    throw new AppError(504, "VTU verify timed out", "VTU_TIMEOUT", err);
  }
  let body: VtuResponse<T> | null = null;
  try {
    body = (await response.json()) as VtuResponse<T>;
  } catch (err) {
    throw new AppError(502, "VTU verify response not JSON", "VTU_ERROR", err);
  }

  logDebug("vtu_verify_response", {
    requestId: ctx?.requestId,
    status: response.status,
    body
  });

  if (!response.ok) {
    logError("vtu_verify_http_error", { requestId: ctx?.requestId, status: response.status, body });
    throw new AppError(502, "VTU verify failed", "VTU_ERROR", body);
  }

  return body ?? {};
};

const isVtuSuccess = (body: VtuResponse<any>) => {
  const code = Number(body.code ?? 0);
  if (code === 101) return true;
  const status = String(body.status ?? body.message ?? "").toLowerCase();
  if (status.includes("success")) return true;
  const description = body.description as any;
  const descStatus =
    typeof description === "string"
      ? description
      : String(description?.Status ?? description?.status ?? "");
  const normalized = descStatus.toLowerCase();
  return normalized.includes("success") || normalized.includes("completed");
};

const mapVtuStatus = (body: VtuResponse<any>) => {
  const description = body.description as any;
  const descriptionText =
    typeof description === "string"
      ? description
      : String(description?.Status ?? description?.status ?? "");
  const raw = String(descriptionText ?? body.status ?? body.message ?? "").toLowerCase();
  if (raw.includes("success") || raw.includes("completed")) return "success";
  if (raw.includes("fail") || raw.includes("error")) return "failed";
  return "pending";
};

const airtimeServices: VtuService[] = [
  { code: "mtn", name: "MTN" },
  { code: "airtel", name: "Airtel" },
  { code: "glo", name: "Glo" },
  { code: "9mobile", name: "9mobile" }
];

const defaultCableServices: VtuService[] = [
  { code: "dstv", name: "DSTV" },
  { code: "gotv", name: "GOTV" },
  { code: "startimes", name: "Startimes" },
  { code: "showmax", name: "Showmax" }
];

const defaultBettingServices: VtuService[] = [
  { code: "bet9ja", name: "Bet9ja" },
  { code: "betking", name: "BetKing" },
  { code: "sportybet", name: "Sportybet" },
  { code: "nairabet", name: "NairaBet" },
  { code: "naijabet", name: "NaijaBet" },
  { code: "1xbet", name: "1xBet" },
  { code: "betway", name: "Betway" },
  { code: "msport", name: "MSport" }
];

const defaultElectricityServices: VtuService[] = [
  { code: "ikeja-electric", name: "Ikeja Electric" },
  { code: "eko-electric", name: "Eko Electric" },
  { code: "ibadan-electric", name: "Ibadan Electric" },
  { code: "jos-electric", name: "Jos Electric" },
  { code: "kaduna-electric", name: "Kaduna Electric" },
  { code: "kano-electric", name: "Kano Electric" },
  { code: "abuja-electric", name: "Abuja Electric" },
  { code: "portharcourt-electric", name: "Port Harcourt Electric" },
  { code: "enugu-electric", name: "Enugu Electric" },
  { code: "benin-electric", name: "Benin Electric" },
  { code: "yola-electric", name: "Yola Electric" },
  { code: "aba-electric", name: "Aba Electric" }
];

const dataPlansCache: CatalogEntry<VtuPlan[]> = {
  fetchedAt: 0,
  data: [],
  inFlight: null
};
const cablePlansCache: CatalogEntry<VtuPlan[]> = {
  fetchedAt: 0,
  data: [],
  inFlight: null
};
const electricityServicesCache: CatalogEntry<VtuService[]> = {
  fetchedAt: 0,
  data: [],
  inFlight: null
};
const bettingServicesCache: CatalogEntry<VtuService[]> = {
  fetchedAt: 0,
  data: [],
  inFlight: null
};

const maxLinkAttempts = 3;

const isCacheFresh = (entry: CatalogEntry<unknown>) =>
  entry.fetchedAt > 0 &&
  Date.now() - entry.fetchedAt < env.VTU_CATALOG_CACHE_SECONDS * 1000;

const ensureCache = async <T>(
  entry: CatalogEntry<T>,
  fetcher: () => Promise<T>,
  logKey: string
) => {
  if (entry.inFlight) {
    return entry.inFlight;
  }
  if (isCacheFresh(entry)) {
    return;
  }
  entry.inFlight = (async () => {
    try {
      const next = await fetcher();
      entry.data = next;
    } catch (err) {
      logWarn(logKey, {
        error: err instanceof Error ? err.message : err
      });
    } finally {
      entry.fetchedAt = Date.now();
      entry.inFlight = null;
    }
  })();
  return entry.inFlight;
};

const fetchHtml = async (url: string) => {
  const response = await fetchWithTimeout(url, { method: "GET" });
  const buffer = await response.arrayBuffer();
  const decoder = new TextDecoder("latin1");
  return decoder.decode(buffer);
};

const parseDataPlans = (html: string): VtuPlan[] => {
  const tables = extractTables(html);
  const plans: VtuPlan[] = [];
  tables.forEach((table) => {
    if (!table.length) return;
    const headers = table[0].map((cell) => cell.toLowerCase());
    const serviceIndex = headers.findIndex((h) => h.includes("service"));
    const planIndex = headers.findIndex((h) => h.includes("dataplan") || h.includes("data plan"));
    if (serviceIndex === -1 || planIndex === -1) return;
    const statusIndex = headers.findIndex((h) => h.includes("status"));
    const resellerIndex = headers.findIndex((h) => h.includes("reseller"));
    const ownerIndex = headers.findIndex((h) => h.includes("owner"));
    const priceIndex =
      resellerIndex >= 0
        ? resellerIndex
        : ownerIndex >= 0
          ? ownerIndex
          : headers.findIndex((h) => h.includes("price") || h.includes("amount"));

    table.slice(1).forEach((row) => {
      const service = row[serviceIndex];
      const plan = row[planIndex];
      if (!service || !plan) return;
      const status = statusIndex >= 0 ? row[statusIndex] : undefined;
      const amountText = priceIndex >= 0 ? row[priceIndex] : undefined;
      plans.push({
        service: service.toLowerCase(),
        code: plan,
        name: plan,
        amount: tryNumber(amountText),
        status
      });
    });
  });
  return plans;
};

const parseCablePlans = (html: string): VtuPlan[] => {
  const tables = extractTables(html);
  const plans: VtuPlan[] = [];
  tables.forEach((table) => {
    if (!table.length) return;
    const headers = table[0].map((cell) => cell.toLowerCase());
    const variationIndex = headers.findIndex(
      (h) => h.includes("variation") || h.includes("code") || h.includes("plan")
    );
    const serviceIndex = headers.findIndex((h) => h.includes("service") || h.includes("provider"));
    const nameIndex = headers.findIndex((h) => h.includes("name") || h.includes("bouquet"));
    const priceIndex = headers.findIndex((h) => h.includes("price") || h.includes("amount"));
    if (variationIndex === -1) return;

    table.slice(1).forEach((row) => {
      const variation = row[variationIndex];
      if (!variation) return;
      const serviceCell = serviceIndex >= 0 ? row[serviceIndex] : "";
      const inferredService = serviceCell
        ? serviceCell
        : variation.split(/[_-]/)[0] ?? "";
      const service = inferredService.toLowerCase();
      const name = nameIndex >= 0 ? row[nameIndex] : variation;
      const amountText = priceIndex >= 0 ? row[priceIndex] : undefined;
      plans.push({
        service,
        code: variation,
        name,
        amount: tryNumber(amountText)
      });
    });
  });
  return plans;
};

const parseServiceList = (html: string, keywords: string[]) => {
  const tables = extractTables(html);
  const services: VtuService[] = [];
  tables.forEach((table) => {
    if (!table.length) return;
    const headers = table[0].map((cell) => cell.toLowerCase());
    const codeIndex = headers.findIndex(
      (h) => h.includes("code") || h.includes("service") || h.includes("provider")
    );
    const nameIndex = headers.findIndex((h) => h.includes("name") || h.includes("disco"));
    if (codeIndex === -1) return;
    table.slice(1).forEach((row) => {
      const code = row[codeIndex];
      if (!code) return;
      const name = nameIndex >= 0 ? row[nameIndex] : code;
      const normalized = code.toLowerCase();
      if (keywords.length && !keywords.some((key) => normalized.includes(key))) return;
      services.push({
        code: normalized,
        name
      });
    });
  });
  return services;
};

const fetchDataPlans = async (): Promise<VtuPlan[]> => {
  const dataDocUrl = buildUrl(env.VTU_DOCS_BASE_URL, "data.php", {});
  const dataHtml = await fetchHtml(dataDocUrl);
  return parseDataPlans(dataHtml);
};

const fetchCablePlans = async (): Promise<VtuPlan[]> => {
  const cableDocUrl = buildUrl(env.VTU_DOCS_BASE_URL, "cable-tv.php", {});
  const cableHtml = await fetchHtml(cableDocUrl);
  let cablePlans = parseCablePlans(cableHtml);
  if (!cablePlans.length) {
    const links = extractLinks(cableHtml, cableDocUrl)
      .filter((link) => /plan|price|subscription|bouquet|variation/i.test(link))
      .slice(0, maxLinkAttempts);
    for (const link of links) {
      try {
        const linkedHtml = await fetchHtml(link);
        const parsed = parseCablePlans(linkedHtml);
        if (parsed.length) {
          cablePlans = parsed;
          break;
        }
      } catch (_) {
        continue;
      }
    }
  }
  return cablePlans;
};

const fetchElectricityServices = async (): Promise<VtuService[]> => {
  const electricityDocUrl = buildUrl(env.VTU_DOCS_BASE_URL, "electricity.php", {});
  const electricityHtml = await fetchHtml(electricityDocUrl);
  let electricityServices = parseServiceList(electricityHtml, ["electric"]);
  if (!electricityServices.length) {
    const links = extractLinks(electricityHtml, electricityDocUrl)
      .filter((link) => /service|disco|electric|code/i.test(link))
      .slice(0, maxLinkAttempts);
    for (const link of links) {
      try {
        const linkedHtml = await fetchHtml(link);
        const parsed = parseServiceList(linkedHtml, ["electric"]);
        if (parsed.length) {
          electricityServices = parsed;
          break;
        }
      } catch (_) {
        continue;
      }
    }
  }
  return electricityServices;
};

const fetchBettingServices = async (): Promise<VtuService[]> => {
  const bettingDocUrl = buildUrl(env.VTU_DOCS_BASE_URL, "betting.php", {});
  const bettingHtml = await fetchHtml(bettingDocUrl);
  let bettingServices = parseServiceList(bettingHtml, []);
  if (!bettingServices.length) {
    const links = extractLinks(bettingHtml, bettingDocUrl)
      .filter((link) => /book|bet|service|code/i.test(link))
      .slice(0, maxLinkAttempts);
    for (const link of links) {
      try {
        const linkedHtml = await fetchHtml(link);
        const parsed = parseServiceList(linkedHtml, []);
        if (parsed.length) {
          bettingServices = parsed;
          break;
        }
      } catch (_) {
        continue;
      }
    }
  }
  return bettingServices;
};

const ensureDataPlans = async () =>
  ensureCache(dataPlansCache, fetchDataPlans, "vtu_catalog_data_fetch_failed");
const ensureCablePlans = async () =>
  ensureCache(cablePlansCache, fetchCablePlans, "vtu_catalog_cable_fetch_failed");
const ensureElectricityServices = async () =>
  ensureCache(
    electricityServicesCache,
    fetchElectricityServices,
    "vtu_catalog_electricity_fetch_failed"
  );
const ensureBettingServices = async () =>
  ensureCache(bettingServicesCache, fetchBettingServices, "vtu_catalog_betting_fetch_failed");

export const getBillCategories = async () => [
  { code: "airtime", name: "Airtime", category: "airtime" },
  { code: "data", name: "Data", category: "data" },
  { code: "cabletv", name: "Cable TV", category: "cabletv" },
  { code: "electricity", name: "Electricity", category: "electricity" },
  { code: "betting", name: "Betting", category: "betting" }
];

export const getBillers = async (category: string) => {
  switch (category.toLowerCase()) {
    case "airtime":
      return airtimeServices.map((service) => ({
        biller_code: service.code,
        name: service.name,
        category
      }));
    case "data": {
      await ensureDataPlans();
      const dataPlans = dataPlansCache.data;
      const services = new Map<string, VtuService>();
      dataPlans.forEach((plan) => {
        if (!plan.service) return;
        services.set(plan.service, { code: plan.service, name: plan.service.toUpperCase() });
      });
      if (!services.size) {
        airtimeServices.forEach((service) => services.set(service.code, service));
      }
      return Array.from(services.values()).map((service) => ({
        biller_code: service.code,
        name: service.name,
        category
      }));
    }
    case "cabletv": {
      await ensureCablePlans();
      const cablePlans = cablePlansCache.data;
      const services = new Map<string, VtuService>();
      cablePlans.forEach((plan) => {
        if (!plan.service) return;
        services.set(plan.service, { code: plan.service, name: plan.service.toUpperCase() });
      });
      const list = services.size ? Array.from(services.values()) : defaultCableServices;
      return list.map((service) => ({
        biller_code: service.code,
        name: service.name,
        category
      }));
    }
    case "electricity": {
      await ensureElectricityServices();
      const list =
        electricityServicesCache.data.length > 0
          ? electricityServicesCache.data
          : defaultElectricityServices;
      return list.map((service) => ({
        biller_code: service.code,
        name: service.name,
        category
      }));
    }
    case "betting": {
      await ensureBettingServices();
      const list =
        bettingServicesCache.data.length > 0
          ? bettingServicesCache.data
          : defaultBettingServices;
      return list.map((service) => ({
        biller_code: service.code,
        name: service.name,
        category
      }));
    }
    default:
      return [];
  }
};

export const getBillItems = async (billerCode: string, category?: string) => {
  const normalizedCategory = category?.toLowerCase() ?? "";

  if (normalizedCategory === "data") {
    await ensureDataPlans();
    return dataPlansCache.data
      .filter((plan) => plan.service === billerCode.toLowerCase())
      .filter((plan) => !plan.status || plan.status.toLowerCase().includes("active"))
      .map((plan) => ({
        item_code: plan.code,
        name: plan.name ?? plan.code,
        amount: plan.amount ?? null
      }));
  }

  if (normalizedCategory === "cabletv") {
    await ensureCablePlans();
    return cablePlansCache.data
      .filter((plan) => plan.service === billerCode.toLowerCase())
      .map((plan) => ({
        item_code: plan.code,
        name: plan.name ?? plan.code,
        amount: plan.amount ?? null
      }));
  }

  if (normalizedCategory === "electricity") {
    return [
      { item_code: "prepaid", name: "Prepaid", amount: null },
      { item_code: "postpaid", name: "Postpaid", amount: null }
    ];
  }

  if (normalizedCategory === "betting") {
    return [{ item_code: "betting", name: "Betting Wallet", amount: null }];
  }

  if (normalizedCategory === "airtime") {
    return [{ item_code: "airtime", name: "Airtime", amount: null }];
  }

  return [];
};

export const validateBillCustomer = async (
  category: string,
  billerCode: string,
  itemCode: string,
  customer: string,
  ctx?: RequestContext
) => {
  const normalizedCategory = category.toLowerCase();
  if (normalizedCategory === "cabletv") {
    const body = await vtuVerify(
      {
        serviceName: "CableTV",
        smartNo: customer,
        service: billerCode,
        variation: itemCode
      },
      ctx
    );
    if (!isVtuSuccess(body)) {
      throw new AppError(400, "Cable TV validation failed", "VTU_VALIDATE_ERROR", body);
    }
    return body.description ?? body;
  }

  if (normalizedCategory === "electricity") {
    const body = await vtuVerify(
      {
        serviceName: "Electricity",
        meterNo: customer,
        service: billerCode,
        metertype: itemCode
      },
      ctx
    );
    if (!isVtuSuccess(body)) {
      throw new AppError(400, "Electricity validation failed", "VTU_VALIDATE_ERROR", body);
    }
    return body.description ?? body;
  }

  if (normalizedCategory === "betting") {
    const body = await vtuVerify(
      {
        serviceName: "Betting",
        userid: customer,
        service: billerCode
      },
      ctx
    );
    if (!isVtuSuccess(body)) {
      throw new AppError(400, "Betting validation failed", "VTU_VALIDATE_ERROR", body);
    }
    return body.description ?? body;
  }

  return {
    status: "skipped"
  };
};

type BillPaymentInput = {
  category: string;
  billerCode: string;
  itemCode: string;
  customerId: string;
  amount: number;
  reference: string;
  requestId?: string;
};

export const createBillPayment = async (input: BillPaymentInput) => {
  const category = input.category.toLowerCase();
  if (category === "airtime") {
    const body = await vtuRequest(
      "airtime/",
      {
        network: input.billerCode,
        phone: input.customerId,
        amount: input.amount,
        ref: input.reference
      },
      { requestId: input.requestId }
    );
    if (!isVtuSuccess(body)) {
      throw new AppError(502, "VTU airtime failed", "VTU_BILLS_ERROR", body);
    }
    return body;
  }

  if (category === "data") {
    const body = await vtuRequest(
      "data/",
      {
        service: input.billerCode,
        MobileNumber: input.customerId,
        DataPlan: input.itemCode,
        ref: input.reference,
        maxamount: input.amount
      },
      { requestId: input.requestId }
    );
    if (!isVtuSuccess(body)) {
      throw new AppError(502, "VTU data failed", "VTU_BILLS_ERROR", body);
    }
    return body;
  }

  if (category === "cabletv") {
    const body = await vtuRequest(
      "paytv/",
      {
        service: input.billerCode,
        smartNo: input.customerId,
        variation: input.itemCode,
        amount: input.amount,
        ref: input.reference
      },
      { requestId: input.requestId }
    );
    if (!isVtuSuccess(body)) {
      throw new AppError(502, "VTU cable failed", "VTU_BILLS_ERROR", body);
    }
    return body;
  }

  if (category === "electricity") {
    const body = await vtuRequest(
      "electric/",
      {
        service: input.billerCode,
        meterNo: input.customerId,
        metertype: input.itemCode,
        amount: input.amount,
        ref: input.reference
      },
      { requestId: input.requestId }
    );
    if (!isVtuSuccess(body)) {
      throw new AppError(502, "VTU electricity failed", "VTU_BILLS_ERROR", body);
    }
    return body;
  }

  if (category === "betting") {
    const body = await vtuRequest(
      "betpay",
      {
        service: input.billerCode,
        userid: input.customerId,
        amount: input.amount,
        ref: input.reference
      },
      { requestId: input.requestId }
    );
    if (!isVtuSuccess(body)) {
      throw new AppError(502, "VTU betting failed", "VTU_BILLS_ERROR", body);
    }
    return body;
  }

  throw new AppError(400, "Unsupported bill category", "VTU_BILLS_ERROR");
};

export const getBillStatus = async (reference: string, ctx?: RequestContext) => {
  const body = await vtuVerify(
    {
      serviceName: "Transaction",
      ref: reference
    },
    ctx
  );
  return body;
};

export const toBillStatus = (body: VtuResponse<any>) => mapVtuStatus(body);

export const buildReference = () => `vtu_${crypto.randomUUID()}`;
