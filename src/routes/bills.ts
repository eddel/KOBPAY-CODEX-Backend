import crypto from "crypto";
import bcrypt from "bcrypt";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../errors";
import { env } from "../config/env";
import {
  purchaseAirtime,
  purchaseData,
  purchasePayTv,
  purchaseElectricity,
  verifyMerchantAccount,
  fundBetAccount,
  verifyCableAccount,
  verifyElectricityAccount
} from "../services/vtuAfricaService";
import { vtuDataPlans } from "../data/vtuDataPlans";
import { vtuCablePlans } from "../data/vtuCablePlans";
import { vtuElectricProviders } from "../data/vtuElectricProviders";
import { vtuBettingProviders, vtuBettingProviderAliases } from "../data/vtuBettingProviders";
import {
  type BeneficiaryCategory,
  buildBeneficiaryKey,
  buildBeneficiaryLabelSuggestion,
  normalizePayload
} from "../utils/beneficiaries";

const router = Router();

const ensureAuth = (userId?: string) => {
  if (!userId) {
    throw new AppError(401, "Missing auth context", "AUTH_CONTEXT_MISSING");
  }
};

const normalizePhone = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("234") && digits.length >= 13) {
    return `0${digits.slice(3)}`;
  }
  if (digits.startsWith("0")) {
    return digits;
  }
  if (digits.length === 10) {
    return `0${digits}`;
  }
  return digits;
};

const isValidNigerianPhone = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("234")) {
    return digits.length === 13;
  }
  return digits.length === 11 && digits.startsWith("0");
};

const isVtuCompleted = (body: Record<string, unknown>) => {
  const code = Number(body.code ?? 0);
  const description = body.description as any;
  const status =
    typeof description === "string"
      ? description
      : String(description?.Status ?? description?.status ?? "");
  const statusOk = status.toLowerCase().includes("completed");
  if (status) {
    return code === 101 && statusOk;
  }
  return code === 101;
};

const parseNumber = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const normalized = value.replace(/[^\d.]/g, "");
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toKobo = (amountNgn: number) => Math.round(amountNgn * 100);

const sumNgn = (amountNgn: number, feeNgn: number) =>
  Number(((toKobo(amountNgn) + toKobo(feeNgn)) / 100).toFixed(2));

const dataSubscriptionFeeNgn = Math.max(0, env.DATA_SUBSCRIPTION_FEE_NGN ?? 0);
const cableSubscriptionFeeNgn = Math.max(0, env.CABLE_SUBSCRIPTION_FEE_NGN ?? 0);
const electricitySubscriptionFeeNgn = Math.max(
  0,
  env.ELECTRICITY_SUBSCRIPTION_FEE_NGN ?? 0
);

const normalizeBettingProvider = (input: string) => {
  const key = input.trim().toLowerCase();
  const alias = vtuBettingProviderAliases[key];
  return alias ?? key;
};

const buildReference = (userId: string, prefix: string) => {
  const userPrefix = userId.split("-")[0] ?? "user";
  return `${prefix}_${userPrefix}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
};

const getOrCreateWallet = async (userId: string) => {
  const existing = await prisma.wallet.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.wallet.create({
    data: {
      userId,
      balanceKobo: 0,
      currency: env.FLW_CURRENCY
    }
  });
};

type DataPlanEntry = {
  id: string;
  network: "mtn" | "airtel" | "glo" | "9mobile";
  service: string;
  dataPlan: string;
  sizeLabel: string;
  validityLabel: string;
  basePriceNgn: number;
  feeNgn: number;
  priceNgn: number;
  displayName: string;
};

const networkLabels: Record<DataPlanEntry["network"], string> = {
  mtn: "MTN",
  airtel: "Airtel",
  glo: "Glo",
  "9mobile": "9mobile"
};

const buildDataCatalog = () => {
  const byNetwork = new Map<DataPlanEntry["network"], Map<string, DataPlanEntry>>();
  const index = new Map<string, DataPlanEntry>();

  vtuDataPlans.forEach((plan) => {
    if (plan.status !== "Active") return;
    const id = `${plan.service}:${plan.dataPlan}`;
    if (!byNetwork.has(plan.network)) {
      byNetwork.set(plan.network, new Map());
    }
    const networkPlans = byNetwork.get(plan.network)!;
    if (networkPlans.has(id)) return;

    const entry: DataPlanEntry = {
      id,
      network: plan.network,
      service: plan.service,
      dataPlan: plan.dataPlan,
      sizeLabel: plan.sizeLabel,
      validityLabel: plan.validityLabel,
      basePriceNgn: plan.priceNgn,
      feeNgn: dataSubscriptionFeeNgn,
      priceNgn: sumNgn(plan.priceNgn, dataSubscriptionFeeNgn),
      displayName: plan.displayName
    };

    networkPlans.set(id, entry);
    index.set(id, entry);
  });

  const sortPlans = (a: DataPlanEntry, b: DataPlanEntry) => {
    if (a.priceNgn !== b.priceNgn) return a.priceNgn - b.priceNgn;
    return a.sizeLabel.localeCompare(b.sizeLabel);
  };

  const networks = (Object.keys(networkLabels) as DataPlanEntry["network"][]).map(
    (network) => ({
      network,
      name: networkLabels[network],
      plans: Array.from(byNetwork.get(network)?.values() ?? []).sort(sortPlans)
    })
  );

  return { networks, index };
};

const dataCatalog = buildDataCatalog();

type CablePlanEntry = {
  id: string;
  provider: "gotv" | "dstv" | "startimes" | "showmax";
  variation: string;
  name: string;
  basePriceNgn: number;
  feeNgn: number;
  priceNgn: number;
  description?: string;
  displayName: string;
};

const cableProviderLabels: Record<CablePlanEntry["provider"], string> = {
  gotv: "GoTV",
  dstv: "DStv",
  startimes: "Startimes",
  showmax: "Showmax"
};

const buildCableCatalog = () => {
  const byProvider = new Map<CablePlanEntry["provider"], Map<string, CablePlanEntry>>();
  const index = new Map<string, CablePlanEntry>();

  vtuCablePlans.forEach((plan) => {
    if (plan.status !== "Active") return;
    if (!plan.priceNgn || plan.priceNgn <= 0) return;

    if (!byProvider.has(plan.provider)) {
      byProvider.set(plan.provider, new Map());
    }
    const providerPlans = byProvider.get(plan.provider)!;
    if (providerPlans.has(plan.variation)) return;

    const basePriceNgn = plan.priceNgn;
    const feeNgn = cableSubscriptionFeeNgn;
    const priceNgn = sumNgn(basePriceNgn, feeNgn);
    const label = plan.description ? `${plan.name} (${plan.description})` : plan.name;
    const displayName = `${cableProviderLabels[plan.provider]} ${label} - NGN ${priceNgn.toLocaleString(
      "en-NG"
    )}`;

    const entry: CablePlanEntry = {
      id: `${plan.provider}:${plan.variation}`,
      provider: plan.provider,
      variation: plan.variation,
      name: plan.name,
      basePriceNgn,
      feeNgn,
      priceNgn,
      description: plan.description,
      displayName
    };

    providerPlans.set(plan.variation, entry);
    index.set(plan.variation, entry);
    index.set(entry.id, entry);
  });

  const providers = (Object.keys(cableProviderLabels) as CablePlanEntry["provider"][])
    .map((provider) => ({
      provider,
      name: cableProviderLabels[provider],
      plans: Array.from(byProvider.get(provider)?.values() ?? []).sort(
        (a, b) => a.priceNgn - b.priceNgn
      )
    }))
    .filter((provider) => provider.plans.length > 0);

  return { providers, index };
};

const cableCatalog = buildCableCatalog();

type ElectricProviderEntry = {
  id: string;
  name: string;
  serviceCode: string;
};

const electricProviders: ElectricProviderEntry[] = vtuElectricProviders.slice();
const electricProviderMap = new Map(
  electricProviders.map((provider) => [provider.serviceCode, provider])
);

const bettingProviders = vtuBettingProviders.slice();
const bettingProviderMap = new Map(
  bettingProviders.map((provider) => [provider.id, provider])
);

const touchBeneficiary = async (
  userId: string,
  category: BeneficiaryCategory,
  payload: any
) => {
  const normalized = normalizePayload(category, payload as any) as any;
  const dedupeKey = buildBeneficiaryKey(category, normalized as any);
  try {
    await prisma.beneficiary.updateMany({
      where: {
        userId,
        category,
        dedupeKey,
        isActive: true
      },
      data: {
        lastUsedAt: new Date()
      }
    });
  } catch (_) {
    // Ignore beneficiary touch failures so payments still succeed.
  }
  return normalized;
};

const buildSuggestion = (category: BeneficiaryCategory, payload: any) => ({
  category,
  payload,
  labelSuggestion: buildBeneficiaryLabelSuggestion(category, payload as any)
});

const buildElectricReceipt = (
  providerResponse: any,
  payload: {
    serviceCode: string;
    meterNo: string;
    meterType: string;
    amountNgn: number;
    customerName?: string | null;
  }
) => {
  const description = providerResponse?.description ?? {};
  const token =
    description?.Token ?? description?.token ?? providerResponse?.Token ?? null;
  const unit = description?.Unit ?? description?.unit ?? null;
  const referenceId =
    description?.ReferenceID ??
    description?.referenceid ??
    providerResponse?.ReferenceID ??
    null;
  const serviceName = description?.ProductName ?? null;

  return {
    token: token ? String(token) : null,
    unit: unit ? String(unit) : null,
    meterNo: payload.meterNo,
    meterType: payload.meterType,
    serviceName: serviceName ? String(serviceName) : null,
    customerName: payload.customerName ?? null,
    amountNgn: payload.amountNgn,
    referenceId: referenceId ? String(referenceId) : null
  };
};

router.post(
  "/airtime/purchase",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const body = z
      .object({
        network: z.enum(["mtn", "airtel", "glo", "9mobile"]),
        phone: z.string().min(8),
        amountNgn: z.coerce.number().min(50),
        pin: z.string().regex(/^\d{4}$/),
        clientRef: z.string().min(6).optional()
      })
      .parse(req.body);

    if (!isValidNigerianPhone(body.phone)) {
      throw new AppError(400, "Invalid Nigerian phone number", "INVALID_PHONE");
    }

    const user = await prisma.user.findUnique({
      where: { id: req.auth!.userId }
    });
    if (!user) {
      throw new AppError(404, "User not found", "USER_NOT_FOUND");
    }

    const security = await prisma.security.findUnique({
      where: { userId: user.id }
    });
    if (!security?.pinHash) {
      throw new AppError(400, "PIN is required", "PIN_REQUIRED");
    }
    const pinOk = await bcrypt.compare(body.pin, security.pinHash);
    if (!pinOk) {
      throw new AppError(401, "Invalid PIN", "PIN_INVALID");
    }

    const amountKobo = Math.round(body.amountNgn * 100);
    const wallet = await getOrCreateWallet(user.id);
    if (wallet.balanceKobo < amountKobo) {
      throw new AppError(400, "Insufficient wallet balance", "INSUFFICIENT_FUNDS");
    }

    const reference = body.clientRef ?? buildReference(user.id, "air");
    const existing = await prisma.transaction.findFirst({
      where: {
        provider: "vtuafrica",
        providerRef: reference,
        userId: user.id
      }
    });
    if (existing) {
      const meta = existing.metaJson as any;
      return res.json({
        ok: true,
        transaction: existing,
        provider: existing.metaJson ?? null,
        customerName: meta?.customerName ?? null,
        wallet: {
          userId: wallet.userId,
          balanceKobo: wallet.balanceKobo,
          currency: wallet.currency
        }
      });
    }

    const debitResult = await prisma.$transaction(async (tx) => {
      const updatedWallet = await tx.wallet.update({
        where: { userId: user.id },
        data: {
          balanceKobo: { decrement: amountKobo }
        }
      });

      const transaction = await tx.transaction.create({
        data: {
          userId: user.id,
          type: "debit",
          category: "airtime",
          amountKobo,
          feeKobo: 0,
          totalKobo: amountKobo,
          provider: "vtuafrica",
          providerRef: reference,
          status: "pending",
          metaJson: {
            network: body.network,
            phone: body.phone,
            amountNgn: body.amountNgn,
            reference
          }
        }
      });

      return { transaction, wallet: updatedWallet };
    });

    const normalizedPhone = normalizePhone(body.phone);

    let providerResponse: Record<string, unknown> | null = null;
    try {
      const vtuResponse = await purchaseAirtime(
        {
          network: body.network,
          phone: normalizedPhone,
          amount: body.amountNgn,
          ref: reference,
          webhookURL: env.VTU_WEBHOOK_URL || undefined
        },
        { requestId: req.requestId }
      );

      providerResponse = vtuResponse as Record<string, unknown>;
      const successful = isVtuCompleted(providerResponse);
      const status = successful ? "success" : "failed";

      await prisma.$transaction(async (tx) => {
        await tx.transaction.update({
          where: { id: debitResult.transaction.id },
          data: {
            status,
            metaJson: {
              ...(typeof debitResult.transaction.metaJson === "object" &&
              debitResult.transaction.metaJson !== null
                ? debitResult.transaction.metaJson
                : {}),
              provider: providerResponse
            }
          }
        });

        if (!successful) {
          await tx.wallet.update({
            where: { userId: user.id },
            data: {
              balanceKobo: { increment: amountKobo }
            }
          });
        }
      });

      const finalTx = await prisma.transaction.findUnique({
        where: { id: debitResult.transaction.id }
      });
      const finalWallet = await prisma.wallet.findUnique({
        where: { userId: user.id }
      });

      if (!successful) {
        throw new AppError(502, "Airtime purchase failed", "VTU_AIRTIME_FAILED", {
          provider: providerResponse
        });
      }

      const suggestionPayload = await touchBeneficiary(user.id, "airtime", {
        network: body.network,
        phone: normalizedPhone
      });

      return res.json({
        ok: true,
        transaction: finalTx,
        provider: providerResponse,
        beneficiarySuggestion: buildSuggestion("airtime", suggestionPayload),
        wallet: finalWallet
          ? {
              userId: finalWallet.userId,
              balanceKobo: finalWallet.balanceKobo,
              currency: finalWallet.currency
            }
          : null
      });
    } catch (err) {
      if (err instanceof AppError) {
        throw err;
      }
      throw new AppError(502, "Airtime purchase failed", "VTU_AIRTIME_FAILED", {
        provider: providerResponse ?? null,
        error: err instanceof Error ? err.message : err
      });
    }
  })
);

router.get(
  "/data/plans",
  asyncHandler(async (_req, res) => {
    res.json({
      ok: true,
      networks: dataCatalog.networks
    });
  })
);

router.get(
  "/cable/plans",
  asyncHandler(async (_req, res) => {
    res.json({
      ok: true,
      providers: cableCatalog.providers
    });
  })
);

router.post(
  "/cable/verify",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const body = z
      .object({
        provider: z.enum(["gotv", "dstv", "startimes"]),
        planId: z.string().min(3),
        smartNo: z.string().min(6)
      })
      .parse(req.body);

    const plan = cableCatalog.index.get(body.planId);
    if (!plan) {
      throw new AppError(400, "Invalid cable plan selected", "INVALID_PLAN");
    }
    if (plan.provider !== body.provider) {
      throw new AppError(400, "Selected plan does not match provider", "INVALID_PLAN_PROVIDER");
    }

    const normalizedSmartNo = body.smartNo.replace(/\D/g, "");
    if (normalizedSmartNo.length < 6) {
      throw new AppError(400, "Invalid smartcard number", "INVALID_SMARTNO");
    }

    const verifyResult = await verifyCableAccount(
      {
        service: body.provider,
        smartNo: normalizedSmartNo,
        variation: plan.variation
      },
      { requestId: req.requestId }
    );

    const hasName = !!verifyResult.customerName;
    const verified = verifyResult.ok && hasName;
    let message = verified
      ? "Smartcard verified successfully"
      : verifyResult.status || "Smartcard not verified";
    if (verifyResult.ok && !hasName) {
      message = "Account name not returned";
    }

    return res.json({
      ok: true,
      verified,
      provider: body.provider,
      smartNo: normalizedSmartNo,
      customerName: verified ? verifyResult.customerName ?? null : null,
      message,
      raw: env.NODE_ENV !== "production" ? verifyResult.raw : undefined
    });
  })
);

router.get(
  "/electricity/providers",
  asyncHandler(async (_req, res) => {
    res.json({
      ok: true,
      providers: electricProviders
    });
  })
);

router.post(
  "/electricity/verify",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const body = z
      .object({
        serviceCode: z.string().min(3),
        meterNo: z.string().min(6),
        meterType: z.enum(["prepaid", "postpaid"])
      })
      .parse(req.body);

    const provider = electricProviderMap.get(body.serviceCode);
    if (!provider) {
      throw new AppError(400, "Invalid electricity provider", "INVALID_PROVIDER");
    }

    const normalizedMeter = body.meterNo.replace(/\D/g, "");
    if (normalizedMeter.length < 6) {
      throw new AppError(400, "Invalid meter number", "INVALID_METERNO");
    }

    const verifyResult = await verifyElectricityAccount(
      {
        service: body.serviceCode,
        meterNo: normalizedMeter,
        meterType: body.meterType
      },
      { requestId: req.requestId }
    );

    const hasName = !!verifyResult.customerName;
    const verified = verifyResult.ok && hasName;
    let message = verified
      ? "Meter verified successfully"
      : verifyResult.status || "Meter not verified";
    if (verifyResult.ok && !hasName) {
      message = "Account name not returned";
    }

    return res.json({
      ok: true,
      verified,
      serviceCode: body.serviceCode,
      meterNo: normalizedMeter,
      meterType: body.meterType,
      customerName: verified ? verifyResult.customerName ?? null : null,
      message,
      raw: env.NODE_ENV !== "production" ? verifyResult.raw : undefined
    });
  })
);

router.get(
  "/betting/providers",
  asyncHandler(async (_req, res) => {
    res.json({
      ok: true,
      providers: bettingProviders
    });
  })
);

router.post(
  "/data/purchase",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const body = z
      .object({
        network: z.enum(["mtn", "airtel", "glo", "9mobile"]),
        planId: z.string().min(3),
        phone: z.string().min(8),
        pin: z.string().regex(/^\d{4}$/),
        clientRef: z.string().min(6).optional()
      })
      .parse(req.body);

    if (!isValidNigerianPhone(body.phone)) {
      throw new AppError(400, "Invalid Nigerian phone number", "INVALID_PHONE");
    }

    const plan = dataCatalog.index.get(body.planId);
    if (!plan) {
      throw new AppError(400, "Invalid data plan selected", "INVALID_PLAN");
    }
    if (plan.network !== body.network) {
      throw new AppError(400, "Selected plan does not match network", "INVALID_PLAN_NETWORK");
    }
    if (!plan.basePriceNgn || plan.basePriceNgn <= 0) {
      throw new AppError(400, "Selected plan has invalid price", "INVALID_PLAN_PRICE");
    }

    const user = await prisma.user.findUnique({
      where: { id: req.auth!.userId }
    });
    if (!user) {
      throw new AppError(404, "User not found", "USER_NOT_FOUND");
    }

    const security = await prisma.security.findUnique({
      where: { userId: user.id }
    });
    if (!security?.pinHash) {
      throw new AppError(400, "PIN is required", "PIN_REQUIRED");
    }
    const pinOk = await bcrypt.compare(body.pin, security.pinHash);
    if (!pinOk) {
      throw new AppError(401, "Invalid PIN", "PIN_INVALID");
    }

    const baseAmountNgn = plan.basePriceNgn;
    const feeNgn = plan.feeNgn;
    const amountNgn = plan.priceNgn;
    const amountKobo = toKobo(amountNgn);
    const wallet = await getOrCreateWallet(user.id);
    if (wallet.balanceKobo < amountKobo) {
      throw new AppError(400, "Insufficient wallet balance", "INSUFFICIENT_FUNDS");
    }

    const reference = body.clientRef ?? buildReference(user.id, "data");
    const existing = await prisma.transaction.findFirst({
      where: {
        provider: "vtuafrica",
        providerRef: reference,
        userId: user.id
      }
    });
    if (existing) {
      return res.json({
        ok: true,
        transaction: existing,
        provider: existing.metaJson ?? null,
        wallet: {
          userId: wallet.userId,
          balanceKobo: wallet.balanceKobo,
          currency: wallet.currency
        }
      });
    }

    const debitResult = await prisma.$transaction(async (tx) => {
      const updatedWallet = await tx.wallet.update({
        where: { userId: user.id },
        data: {
          balanceKobo: { decrement: amountKobo }
        }
      });

      const transaction = await tx.transaction.create({
        data: {
          userId: user.id,
          type: "debit",
          category: "data",
          amountKobo,
          feeKobo: 0,
          totalKobo: amountKobo,
          provider: "vtuafrica",
          providerRef: reference,
          status: "pending",
          metaJson: {
            network: body.network,
            phone: body.phone,
            planId: body.planId,
            plan: {
              service: plan.service,
              dataPlan: plan.dataPlan,
              sizeLabel: plan.sizeLabel,
              validityLabel: plan.validityLabel,
              basePriceNgn: plan.basePriceNgn,
              feeNgn: plan.feeNgn,
              priceNgn: plan.priceNgn,
              displayName: plan.displayName
            },
            pricing: {
              baseAmountNgn,
              feeNgn,
              totalAmountNgn: amountNgn
            },
            reference
          }
        }
      });

      return { transaction, wallet: updatedWallet };
    });

    const normalizedPhone = normalizePhone(body.phone);

    let providerResponse: Record<string, unknown> | null = null;
    try {
      const vtuResponse = await purchaseData(
        {
          service: plan.service,
          mobileNumber: normalizedPhone,
          dataPlan: plan.dataPlan,
          ref: reference,
          maxamount: String(baseAmountNgn),
          webhookURL: env.VTU_WEBHOOK_URL || undefined
        },
        { requestId: req.requestId }
      );

      providerResponse = vtuResponse as Record<string, unknown>;
      const successful = isVtuCompleted(providerResponse);
      const status = successful ? "success" : "failed";

      await prisma.$transaction(async (tx) => {
        await tx.transaction.update({
          where: { id: debitResult.transaction.id },
          data: {
            status,
            metaJson: {
              ...(typeof debitResult.transaction.metaJson === "object" &&
              debitResult.transaction.metaJson !== null
                ? debitResult.transaction.metaJson
                : {}),
              provider: providerResponse
            }
          }
        });

        if (!successful) {
          await tx.wallet.update({
            where: { userId: user.id },
            data: {
              balanceKobo: { increment: amountKobo }
            }
          });
        }
      });

      const finalTx = await prisma.transaction.findUnique({
        where: { id: debitResult.transaction.id }
      });
      const finalWallet = await prisma.wallet.findUnique({
        where: { userId: user.id }
      });

      if (!successful) {
        throw new AppError(502, "Data purchase failed", "VTU_DATA_FAILED", {
          provider: providerResponse
        });
      }

      const suggestionPayload = await touchBeneficiary(user.id, "data", {
        network: body.network,
        phone: normalizedPhone
      });

      return res.json({
        ok: true,
        transaction: finalTx,
        provider: providerResponse,
        beneficiarySuggestion: buildSuggestion("data", suggestionPayload),
        wallet: finalWallet
          ? {
              userId: finalWallet.userId,
              balanceKobo: finalWallet.balanceKobo,
              currency: finalWallet.currency
            }
          : null
      });
    } catch (err) {
      if (err instanceof AppError) {
        throw err;
      }
      throw new AppError(502, "Data purchase failed", "VTU_DATA_FAILED", {
        provider: providerResponse ?? null,
        error: err instanceof Error ? err.message : err
      });
    }
  })
);

router.post(
  "/cable/purchase",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const body = z
      .object({
        provider: z.enum(["gotv", "dstv", "startimes"]),
        planId: z.string().min(3),
        smartNo: z.string().min(6),
        pin: z.string().regex(/^\d{4}$/),
        clientRef: z.string().min(6).optional()
      })
      .parse(req.body);

    const normalizedSmartNo = body.smartNo.replace(/\D/g, "");
    if (normalizedSmartNo.length < 6) {
      throw new AppError(400, "Invalid smartcard number", "INVALID_SMARTNO");
    }

    const plan = cableCatalog.index.get(body.planId);
    if (!plan) {
      throw new AppError(400, "Invalid cable plan selected", "INVALID_PLAN");
    }
    if (plan.provider !== body.provider) {
      throw new AppError(400, "Selected plan does not match provider", "INVALID_PLAN_PROVIDER");
    }
    if (!plan.basePriceNgn || plan.basePriceNgn <= 0) {
      throw new AppError(400, "Selected plan has invalid price", "INVALID_PLAN_PRICE");
    }

    const user = await prisma.user.findUnique({
      where: { id: req.auth!.userId }
    });
    if (!user) {
      throw new AppError(404, "User not found", "USER_NOT_FOUND");
    }

    const security = await prisma.security.findUnique({
      where: { userId: user.id }
    });
    if (!security?.pinHash) {
      throw new AppError(400, "PIN is required", "PIN_REQUIRED");
    }
    const pinOk = await bcrypt.compare(body.pin, security.pinHash);
    if (!pinOk) {
      throw new AppError(401, "Invalid PIN", "PIN_INVALID");
    }

    const verifyResult = await verifyCableAccount(
      {
        service: body.provider,
        smartNo: normalizedSmartNo,
        variation: plan.variation
      },
      { requestId: req.requestId }
    );
    if (!verifyResult.ok || !verifyResult.customerName) {
      throw new AppError(400, "Smartcard not verified", "CABLE_NOT_VERIFIED", {
        status: verifyResult.status
      });
    }

    const baseAmountNgn = plan.basePriceNgn;
    const feeNgn = plan.feeNgn;
    const amountNgn = plan.priceNgn;
    const amountKobo = toKobo(amountNgn);
    const wallet = await getOrCreateWallet(user.id);
    if (wallet.balanceKobo < amountKobo) {
      throw new AppError(400, "Insufficient wallet balance", "INSUFFICIENT_FUNDS");
    }

    const reference = body.clientRef ?? buildReference(user.id, "cable");
    const existing = await prisma.transaction.findFirst({
      where: {
        provider: "vtuafrica",
        providerRef: reference,
        userId: user.id
      }
    });
    if (existing) {
      return res.json({
        ok: true,
        transaction: existing,
        provider: existing.metaJson ?? null,
        wallet: {
          userId: wallet.userId,
          balanceKobo: wallet.balanceKobo,
          currency: wallet.currency
        }
      });
    }

    const debitResult = await prisma.$transaction(async (tx) => {
      const updatedWallet = await tx.wallet.update({
        where: { userId: user.id },
        data: {
          balanceKobo: { decrement: amountKobo }
        }
      });

      const transaction = await tx.transaction.create({
        data: {
          userId: user.id,
          type: "debit",
          category: "cable",
          amountKobo,
          feeKobo: 0,
          totalKobo: amountKobo,
          provider: "vtuafrica",
          providerRef: reference,
          status: "pending",
          metaJson: {
            provider: body.provider,
            smartNo: normalizedSmartNo,
            planId: plan.id,
            customerName: verifyResult.customerName ?? null,
            plan: {
              variation: plan.variation,
              name: plan.name,
              basePriceNgn: plan.basePriceNgn,
              feeNgn: plan.feeNgn,
              priceNgn: plan.priceNgn,
              description: plan.description
            },
            pricing: {
              baseAmountNgn,
              feeNgn,
              totalAmountNgn: amountNgn
            },
            reference
          }
        }
      });

      return { transaction, wallet: updatedWallet };
    });

    let providerResponse: Record<string, unknown> | null = null;
    try {
      const vtuResponse = await purchasePayTv(
        {
          service: body.provider,
          smartNo: normalizedSmartNo,
          variation: plan.variation,
          ref: reference,
          maxamount: String(baseAmountNgn),
          webhookURL: env.VTU_WEBHOOK_URL || undefined
        },
        { requestId: req.requestId }
      );

      providerResponse = vtuResponse as Record<string, unknown>;
      const successful = isVtuCompleted(providerResponse);
      const status = successful ? "success" : "failed";

      await prisma.$transaction(async (tx) => {
        await tx.transaction.update({
          where: { id: debitResult.transaction.id },
          data: {
            status,
            metaJson: {
              ...(typeof debitResult.transaction.metaJson === "object" &&
              debitResult.transaction.metaJson !== null
                ? debitResult.transaction.metaJson
                : {}),
              provider: providerResponse
            }
          }
        });

        if (!successful) {
          await tx.wallet.update({
            where: { userId: user.id },
            data: {
              balanceKobo: { increment: amountKobo }
            }
          });
        }
      });

      const finalTx = await prisma.transaction.findUnique({
        where: { id: debitResult.transaction.id }
      });
      const finalWallet = await prisma.wallet.findUnique({
        where: { userId: user.id }
      });

      if (!successful) {
        throw new AppError(502, "Cable subscription failed", "VTU_CABLE_FAILED", {
          provider: providerResponse
        });
      }

      const suggestionPayload = await touchBeneficiary(user.id, "cable", {
        provider: body.provider,
        smartNo: normalizedSmartNo,
        planVariation: plan.variation
      });

      return res.json({
        ok: true,
        transaction: finalTx,
        provider: providerResponse,
        customerName: verifyResult.customerName ?? null,
        beneficiarySuggestion: buildSuggestion("cable", suggestionPayload),
        wallet: finalWallet
          ? {
              userId: finalWallet.userId,
              balanceKobo: finalWallet.balanceKobo,
              currency: finalWallet.currency
            }
          : null
      });
    } catch (err) {
      if (err instanceof AppError) {
        throw err;
      }
      throw new AppError(502, "Cable subscription failed", "VTU_CABLE_FAILED", {
        provider: providerResponse ?? null,
        error: err instanceof Error ? err.message : err
      });
    }
  })
);

router.post(
  "/electricity/purchase",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const body = z
      .object({
        serviceCode: z.string().min(3),
        meterNo: z.string().min(6),
        meterType: z.enum(["prepaid", "postpaid"]),
        amountNgn: z.coerce.number().int().min(900),
        pin: z.string().regex(/^\d{4}$/),
        clientRef: z.string().min(6).optional()
      })
      .parse(req.body);

    const provider = electricProviderMap.get(body.serviceCode);
    if (!provider) {
      throw new AppError(400, "Invalid electricity provider", "INVALID_PROVIDER");
    }

    const normalizedMeter = body.meterNo.replace(/\D/g, "");
    if (normalizedMeter.length < 6) {
      throw new AppError(400, "Invalid meter number", "INVALID_METERNO");
    }

    const user = await prisma.user.findUnique({
      where: { id: req.auth!.userId }
    });
    if (!user) {
      throw new AppError(404, "User not found", "USER_NOT_FOUND");
    }

    const security = await prisma.security.findUnique({
      where: { userId: user.id }
    });
    if (!security?.pinHash) {
      throw new AppError(400, "PIN is required", "PIN_REQUIRED");
    }
    const pinOk = await bcrypt.compare(body.pin, security.pinHash);
    if (!pinOk) {
      throw new AppError(401, "Invalid PIN", "PIN_INVALID");
    }

    const verifyResult = await verifyElectricityAccount(
      {
        service: body.serviceCode,
        meterNo: normalizedMeter,
        meterType: body.meterType
      },
      { requestId: req.requestId }
    );
    if (!verifyResult.ok || !verifyResult.customerName) {
      throw new AppError(400, "Meter not verified", "ELECTRIC_NOT_VERIFIED", {
        status: verifyResult.status
      });
    }

    const baseAmountNgn = body.amountNgn;
    if (baseAmountNgn < 900) {
      throw new AppError(400, "Minimum amount is NGN 900", "MIN_AMOUNT");
    }

    const feeNgn = electricitySubscriptionFeeNgn;
    const amountNgn = sumNgn(baseAmountNgn, feeNgn);
    const amountKobo = toKobo(amountNgn);
    const wallet = await getOrCreateWallet(user.id);
    if (wallet.balanceKobo < amountKobo) {
      throw new AppError(400, "Insufficient wallet balance", "INSUFFICIENT_FUNDS");
    }

    const reference = body.clientRef ?? buildReference(user.id, "elec");
    const existing = await prisma.transaction.findFirst({
      where: {
        provider: "vtuafrica",
        providerRef: reference,
        userId: user.id
      }
    });
    if (existing) {
      const meta = existing.metaJson as any;
      const providerResponse = meta?.provider ?? null;
      const receipt =
        meta?.receipt ??
        (providerResponse
          ? buildElectricReceipt(providerResponse, {
              serviceCode: meta?.serviceCode ?? body.serviceCode,
              meterNo: meta?.meterNo ?? body.meterNo,
              meterType: meta?.meterType ?? body.meterType,
              amountNgn: meta?.amountNgn ?? baseAmountNgn,
              customerName: meta?.customerName ?? null
            })
          : null);

      return res.json({
        ok: true,
        transaction: existing,
        provider: providerResponse,
        receipt,
        wallet: {
          userId: wallet.userId,
          balanceKobo: wallet.balanceKobo,
          currency: wallet.currency
        }
      });
    }

    const debitResult = await prisma.$transaction(async (tx) => {
      const updatedWallet = await tx.wallet.update({
        where: { userId: user.id },
        data: {
          balanceKobo: { decrement: amountKobo }
        }
      });

      const transaction = await tx.transaction.create({
        data: {
          userId: user.id,
          type: "debit",
          category: "electricity",
          amountKobo,
          feeKobo: 0,
          totalKobo: amountKobo,
          provider: "vtuafrica",
          providerRef: reference,
          status: "pending",
          metaJson: {
            serviceCode: body.serviceCode,
            meterNo: normalizedMeter,
            meterType: body.meterType,
            amountNgn: baseAmountNgn,
            customerName: verifyResult.customerName ?? null,
            pricing: {
              baseAmountNgn,
              feeNgn,
              totalAmountNgn: amountNgn
            },
            reference
          }
        }
      });

      return { transaction, wallet: updatedWallet };
    });

    let providerResponse: Record<string, unknown> | null = null;
    try {
      const vtuResponse = await purchaseElectricity(
        {
          service: body.serviceCode,
          meterNo: normalizedMeter,
          meterType: body.meterType,
          amount: baseAmountNgn,
          ref: reference,
          webhookURL: env.VTU_WEBHOOK_URL || undefined
        },
        { requestId: req.requestId }
      );

      providerResponse = vtuResponse as Record<string, unknown>;
      const successful = isVtuCompleted(providerResponse);
      const status = successful ? "success" : "failed";
      const receipt = buildElectricReceipt(providerResponse, {
        serviceCode: body.serviceCode,
        meterNo: normalizedMeter,
        meterType: body.meterType,
        amountNgn: baseAmountNgn,
        customerName: verifyResult.customerName ?? null
      });

      await prisma.$transaction(async (tx) => {
        await tx.transaction.update({
          where: { id: debitResult.transaction.id },
          data: {
            status,
            metaJson: {
              ...(typeof debitResult.transaction.metaJson === "object" &&
              debitResult.transaction.metaJson !== null
                ? debitResult.transaction.metaJson
                : {}),
              provider: providerResponse,
              receipt
            }
          }
        });

        if (!successful) {
          await tx.wallet.update({
            where: { userId: user.id },
            data: {
              balanceKobo: { increment: amountKobo }
            }
          });
        }
      });

      const finalTx = await prisma.transaction.findUnique({
        where: { id: debitResult.transaction.id }
      });
      const finalWallet = await prisma.wallet.findUnique({
        where: { userId: user.id }
      });

      if (!successful) {
        throw new AppError(502, "Electricity purchase failed", "VTU_ELECTRIC_FAILED", {
          provider: providerResponse
        });
      }

      const suggestionPayload = await touchBeneficiary(user.id, "electricity", {
        serviceCode: body.serviceCode,
        meterNo: normalizedMeter,
        meterType: body.meterType
      });

      return res.json({
        ok: true,
        transaction: finalTx,
        provider: providerResponse,
        receipt,
        beneficiarySuggestion: buildSuggestion("electricity", suggestionPayload),
        wallet: finalWallet
          ? {
              userId: finalWallet.userId,
              balanceKobo: finalWallet.balanceKobo,
              currency: finalWallet.currency
            }
          : null
      });
    } catch (err) {
      if (err instanceof AppError) {
        throw err;
      }
      throw new AppError(502, "Electricity purchase failed", "VTU_ELECTRIC_FAILED", {
        provider: providerResponse ?? null,
        error: err instanceof Error ? err.message : err
      });
    }
  })
);

router.post(
  "/betting/verify",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const body = z
      .object({
        provider: z.string().min(2),
        userId: z.string().min(4)
      })
      .parse(req.body);

    const providerId = normalizeBettingProvider(body.provider);
    if (!bettingProviderMap.has(providerId)) {
      throw new AppError(400, "Invalid betting provider", "INVALID_PROVIDER");
    }

    const normalizedUserId = body.userId.replace(/\s+/g, "");
    if (!/^\d+$/.test(normalizedUserId)) {
      throw new AppError(400, "Invalid betting account id", "INVALID_USERID");
    }

    const verifyResult = await verifyMerchantAccount(
      {
        serviceName: "Betting",
        service: providerId,
        userid: normalizedUserId
      },
      { requestId: req.requestId }
    );

    const hasName = !!verifyResult.customerName;
    const verified = verifyResult.ok && hasName;
    let message = verified
      ? "Bet account verified successfully"
      : verifyResult.status || "Bet account not verified";
    if (verifyResult.ok && !hasName) {
      message = "Account name not returned";
    }

    return res.json({
      ok: true,
      verified,
      provider: providerId,
      userId: normalizedUserId,
      customerName: verified ? verifyResult.customerName ?? null : null,
      message,
      raw: env.NODE_ENV !== "production" ? verifyResult.raw : undefined
    });
  })
);

router.post(
  "/betting/purchase",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const body = z
      .object({
        provider: z.string().min(2),
        userId: z.string().min(4),
        amountNgn: z.coerce.number().min(100),
        pin: z.string().regex(/^\d{4}$/),
        clientRef: z.string().min(6).optional()
      })
      .parse(req.body);

    const providerId = normalizeBettingProvider(body.provider);
    if (!bettingProviderMap.has(providerId)) {
      throw new AppError(400, "Invalid betting provider", "INVALID_PROVIDER");
    }

    const normalizedUserId = body.userId.replace(/\s+/g, "");
    if (!/^\d+$/.test(normalizedUserId)) {
      throw new AppError(400, "Invalid betting account id", "INVALID_USERID");
    }

    const user = await prisma.user.findUnique({
      where: { id: req.auth!.userId }
    });
    if (!user) {
      throw new AppError(404, "User not found", "USER_NOT_FOUND");
    }

    const security = await prisma.security.findUnique({
      where: { userId: user.id }
    });
    if (!security?.pinHash) {
      throw new AppError(400, "PIN is required", "PIN_REQUIRED");
    }
    const pinOk = await bcrypt.compare(body.pin, security.pinHash);
    if (!pinOk) {
      throw new AppError(401, "Invalid PIN", "PIN_INVALID");
    }

    const verifyResult = await verifyMerchantAccount(
      {
        serviceName: "Betting",
        service: providerId,
        userid: normalizedUserId
      },
      { requestId: req.requestId }
    );
    if (!verifyResult.ok || !verifyResult.customerName) {
      throw new AppError(400, "Bet account not verified", "BET_NOT_VERIFIED", {
        status: verifyResult.status,
        provider: providerId,
        userId: normalizedUserId
      });
    }

    const amountNgn = body.amountNgn;
    const amountKobo = Math.round(amountNgn * 100);
    const wallet = await getOrCreateWallet(user.id);
    const bufferKobo = 100 * 100;
    if (wallet.balanceKobo < amountKobo + bufferKobo) {
      throw new AppError(400, "Insufficient wallet balance", "INSUFFICIENT_FUNDS");
    }

    const reference = body.clientRef ?? buildReference(user.id, "bet");
    const existing = await prisma.transaction.findFirst({
      where: {
        provider: "vtuafrica",
        providerRef: reference,
        userId: user.id
      }
    });
    if (existing) {
      const meta = existing.metaJson as any;
      return res.json({
        ok: true,
        transaction: existing,
        provider: meta?.provider ?? null,
        wallet: {
          userId: wallet.userId,
          balanceKobo: wallet.balanceKobo,
          currency: wallet.currency
        },
        customerName: meta?.customerName ?? verifyResult.customerName ?? null
      });
    }

    const pendingTx = await prisma.transaction.create({
      data: {
        userId: user.id,
        type: "debit",
        category: "betting",
        amountKobo,
        feeKobo: 0,
        totalKobo: amountKobo,
        provider: "vtuafrica",
        providerRef: reference,
        status: "pending",
        metaJson: {
          provider: providerId,
          userId: normalizedUserId,
          amountNgn,
          customerName: verifyResult.customerName ?? null,
          verification: {
            status: verifyResult.status,
            ok: verifyResult.ok
          },
          reference
        }
      }
    });

    let providerResponse: Record<string, unknown> | null = null;
    try {
      const vtuResponse = await fundBetAccount(
        {
          service: providerId,
          userid: normalizedUserId,
          amount: amountNgn,
          ref: reference,
          phone: user.phone ?? undefined,
          webhookURL: env.VTU_WEBHOOK_URL || undefined
        },
        { requestId: req.requestId }
      );

      providerResponse = vtuResponse as Record<string, unknown>;
      const successful = isVtuCompleted(providerResponse);
      if (!successful) {
        await prisma.transaction.update({
          where: { id: pendingTx.id },
          data: {
            status: "failed",
            metaJson: {
              ...(typeof pendingTx.metaJson === "object" && pendingTx.metaJson !== null
                ? pendingTx.metaJson
                : {}),
              provider: providerResponse
            }
          }
        });
        throw new AppError(502, "Betting funding failed", "VTU_BETTING_FAILED", {
          provider: providerResponse
        });
      }

      const description = (providerResponse as any)?.description ?? {};
      const requestAmount =
        parseNumber(description?.Request_Amount ?? description?.RequestAmount) ?? amountNgn;
      const charge = parseNumber(description?.Charge ?? description?.charge);
      let amountCharged =
        parseNumber(description?.Amount_Charged ?? description?.AmountCharged) ?? null;
      if (amountCharged == null) {
        amountCharged = charge != null ? requestAmount + charge : requestAmount;
      }

      const amountChargedKobo = Math.round(amountCharged * 100);
      const feeKobo = Math.max(0, Math.round((amountCharged - requestAmount) * 100));

      const updated = await prisma.$transaction(async (tx) => {
        const freshWallet = await tx.wallet.findUnique({ where: { userId: user.id } });
        if (!freshWallet || freshWallet.balanceKobo < amountChargedKobo) {
          await tx.transaction.update({
            where: { id: pendingTx.id },
            data: {
              status: "failed",
              metaJson: {
                ...(typeof pendingTx.metaJson === "object" && pendingTx.metaJson !== null
                  ? pendingTx.metaJson
                  : {}),
                provider: providerResponse,
                chargeError: "INSUFFICIENT_FUNDS_FOR_PROVIDER"
              }
            }
          });
          throw new AppError(
            400,
            `Insufficient wallet balance to cover provider charge of NGN ${amountCharged}`,
            "INSUFFICIENT_FUNDS"
          );
        }

        const newWallet = await tx.wallet.update({
          where: { userId: user.id },
          data: {
            balanceKobo: { decrement: amountChargedKobo }
          }
        });

        const transaction = await tx.transaction.update({
          where: { id: pendingTx.id },
          data: {
            amountKobo: amountChargedKobo,
            feeKobo,
            totalKobo: amountChargedKobo,
            status: "success",
            metaJson: {
              ...(typeof pendingTx.metaJson === "object" && pendingTx.metaJson !== null
                ? pendingTx.metaJson
                : {}),
              provider: providerResponse,
              charged: {
                requestAmount,
                charge: charge ?? 0,
                amountCharged
              }
            }
          }
        });

        return { transaction, wallet: newWallet };
      });

      return res.json({
        ok: true,
        transaction: updated.transaction,
        wallet: updated.wallet
          ? {
              userId: updated.wallet.userId,
              balanceKobo: updated.wallet.balanceKobo,
              currency: updated.wallet.currency
            }
          : null,
        providerResponse: providerResponse,
        customerName: verifyResult.customerName ?? null
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : err;
      await prisma.transaction.update({
        where: { id: pendingTx.id },
        data: {
          status: "failed",
          metaJson: {
            ...(typeof pendingTx.metaJson === "object" && pendingTx.metaJson !== null
              ? pendingTx.metaJson
              : {}),
            provider: providerResponse ?? null,
            error: errorMessage
          }
        }
      });

      if (err instanceof AppError) {
        throw err;
      }
      throw new AppError(502, "Betting funding failed", "VTU_BETTING_FAILED", {
        provider: providerResponse ?? null,
        error: errorMessage
      });
    }
  })
);

export default router;
