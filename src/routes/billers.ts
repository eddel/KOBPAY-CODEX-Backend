import bcrypt from "bcrypt";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../errors";
import { env } from "../config/env";
import {
  createBillPayment,
  getBillCategories,
  getBillers,
  getBillItems,
  validateBillCustomer,
  toBillStatus,
  buildReference
} from "../services/vtuAfricaBillsService";
import { logInfo, logWarn } from "../utils/logger";

const router = Router();

const ensureAuth = (userId?: string) => {
  if (!userId) {
    throw new AppError(401, "Missing auth context", "AUTH_CONTEXT_MISSING");
  }
};

const pinSchema = z
  .string()
  .regex(/^\d{4}$/)
  .describe("4-digit PIN");

const getOrCreateWallet = async (userId: string) => {
  const existing = await prisma.wallet.findUnique({ where: { userId } });
  if (existing) {
    return existing;
  }
  return prisma.wallet.create({
    data: {
      userId,
      balanceKobo: 0,
      currency: env.FLW_CURRENCY
    }
  });
};

const toKobo = (amount?: number, amountKobo?: number | string) => {
  const coercedKobo =
    typeof amountKobo === "string" ? Number(amountKobo) : amountKobo;
  if (coercedKobo && coercedKobo > 0) {
    return coercedKobo;
  }
  if (amount && amount > 0) {
    return Math.round(amount * 100);
  }
  return 0;
};

const pickNumber = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
};

const pickString = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return undefined;
};

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = z
      .object({
        country: z.string().length(2).optional(),
        category: z.string().optional()
      })
      .parse(req.query);

    logInfo("billers_list_request", {
      requestId: req.requestId,
      category: query.category ?? null,
      country: query.country ?? env.FLW_COUNTRY
    });

    if (query.category) {
      const billers = await getBillers(query.category);
      return res.json({ ok: true, billers });
    }

    const categories = await getBillCategories();
    return res.json({ ok: true, categories });
  })
);

router.get(
  "/validate",
  asyncHandler(async (req, res) => {
    const query = z
      .object({
        category: z.string().min(2),
        billerCode: z.string().min(2),
        itemCode: z.string().min(2),
        customer: z.string().min(3)
      })
      .parse(req.query);

    logInfo("billers_validate_request", {
      requestId: req.requestId,
      category: query.category,
      billerCode: query.billerCode,
      itemCode: query.itemCode
    });

    const result = await validateBillCustomer(
      query.category,
      query.billerCode,
      query.itemCode,
      query.customer,
      { requestId: req.requestId }
    );

    res.json({ ok: true, validation: result });
  })
);

router.get(
  "/:billerId/plans",
  asyncHandler(async (req, res) => {
    const query = z
      .object({
        category: z.string().optional()
      })
      .parse(req.query);

    logInfo("billers_items_request", {
      requestId: req.requestId,
      billerCode: req.params.billerId,
      category: query.category ?? null
    });

    const items = await getBillItems(req.params.billerId, query.category);
    res.json({ ok: true, plans: items });
  })
);

router.post(
  "/pay",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const body = z
      .object({
        billerCode: z.string().min(2),
        itemCode: z.string().min(2),
        customerId: z.string().min(3),
        amount: z.coerce.number().positive().optional(),
        amountKobo: z.coerce.number().int().positive().optional(),
        narration: z.string().max(140).optional(),
        reference: z.string().min(6).optional(),
        validate: z.coerce.boolean().optional(),
        callbackUrl: z.string().url().optional(),
        country: z.string().length(2).optional(),
        category: z.string().max(50),
        pin: pinSchema.optional(),
        item: z.record(z.any()).optional()
      })
      .parse(req.body);

    logInfo("billers_pay_request", {
      requestId: req.requestId,
      billerCode: body.billerCode,
      itemCode: body.itemCode,
      category: body.category ?? null,
      reference: body.reference ?? null
    });

    let itemMeta =
      body.item && typeof body.item === "object"
        ? (body.item as Record<string, unknown>)
        : undefined;

    let itemAmount =
      itemMeta ? pickNumber(itemMeta, ["amount", "price", "amountKobo"]) : undefined;

    if (!itemMeta || itemAmount === undefined) {
      const items = await getBillItems(body.billerCode, body.category);
      const found = items.find((entry) => {
        const code = pickString(entry, ["item_code", "itemCode", "code", "id"]);
        return code === body.itemCode;
      });
      if (found) {
        itemMeta = found;
        itemAmount = pickNumber(found, ["amount", "price", "amountKobo"]);
      } else {
        logWarn("billers_item_not_found", {
          requestId: req.requestId,
          billerCode: body.billerCode,
          itemCode: body.itemCode
        });
      }
    }

    if (itemAmount !== undefined && body.amount !== undefined) {
      const normalized = Number(itemAmount);
      if (Number.isFinite(normalized) && Math.abs(normalized - body.amount) > 0.01) {
        throw new AppError(400, "Amount must match the selected plan", "AMOUNT_MISMATCH");
      }
    }
    if (itemAmount !== undefined && body.amountKobo !== undefined) {
      const normalized = Math.round(Number(itemAmount) * 100);
      if (Number.isFinite(normalized) && normalized !== body.amountKobo) {
        throw new AppError(400, "Amount must match the selected plan", "AMOUNT_MISMATCH");
      }
    }

    const amountKobo = toKobo(
      body.amount ?? (itemAmount !== undefined ? Number(itemAmount) : undefined),
      body.amountKobo
    );

    if (!amountKobo || amountKobo <= 0) {
      throw new AppError(400, "Amount must be greater than zero", "AMOUNT_REQUIRED");
    }

    const wallet = await getOrCreateWallet(req.auth!.userId);
    if (wallet.balanceKobo < amountKobo) {
      throw new AppError(400, "Insufficient wallet balance", "INSUFFICIENT_FUNDS");
    }

    const security = await prisma.security.findUnique({
      where: { userId: wallet.userId }
    });
    if (security?.pinHash) {
      if (!body.pin) {
        throw new AppError(400, "PIN is required", "PIN_REQUIRED");
      }
      const ok = await bcrypt.compare(body.pin, security.pinHash);
      if (!ok) {
        throw new AppError(401, "Invalid PIN", "PIN_INVALID");
      }
    }

    if (body.validate) {
      await validateBillCustomer(
        body.category,
        body.billerCode,
        body.itemCode,
        body.customerId,
        { requestId: req.requestId }
      );
    }

    const idempotencyKey =
      (req.headers["x-idempotency-key"] as string | undefined) ??
      (req.headers["idempotency-key"] as string | undefined);
    const reference = body.reference ?? idempotencyKey ?? buildReference();
    const existing = await prisma.transaction.findFirst({
      where: {
        userId: wallet.userId,
        provider: "vtuafrica",
        providerRef: reference
      }
    });
    if (existing) {
      return res.json({
        ok: true,
        transaction: existing,
        wallet: {
          userId: wallet.userId,
          balanceKobo: wallet.balanceKobo,
          currency: wallet.currency
        }
      });
    }

    const debitResult = await prisma.$transaction(async (tx) => {
      const updatedWallet = await tx.wallet.update({
        where: { userId: wallet.userId },
        data: {
          balanceKobo: { decrement: amountKobo }
        }
      });

      const transaction = await tx.transaction.create({
        data: {
          userId: wallet.userId,
          type: "debit",
          category: "bills",
          amountKobo,
          feeKobo: 0,
          totalKobo: amountKobo,
          provider: "vtuafrica",
          providerRef: reference,
          status: "pending",
          metaJson: {
            billerCode: body.billerCode,
            itemCode: body.itemCode,
            customerId: body.customerId,
            amountKobo,
            narration: body.narration ?? null,
            reference,
            category: body.category ?? null,
            item: itemMeta ?? null,
            type: null
          }
        }
      });

      return { transaction, wallet: updatedWallet };
    });

    try {
      const amount = Number((amountKobo / 100).toFixed(2));

      const vtuData = await createBillPayment({
        billerCode: body.billerCode,
        itemCode: body.itemCode,
        customerId: body.customerId,
        amount,
        reference,
        category: body.category,
        requestId: req.requestId
      });

      const status = toBillStatus(vtuData as any);

      await prisma.$transaction(async (tx) => {
        await tx.transaction.update({
          where: { id: debitResult.transaction.id },
          data: {
            status,
            feeKobo: 0,
            totalKobo: amountKobo,
            metaJson: {
              ...(typeof debitResult.transaction.metaJson === "object" &&
              debitResult.transaction.metaJson !== null
                ? debitResult.transaction.metaJson
                : {}),
              vtu: vtuData
            }
          }
        });

        if (status === "failed") {
          await tx.wallet.update({
            where: { userId: wallet.userId },
            data: {
              balanceKobo: { increment: amountKobo }
            }
          });
        }
      });

      const updatedTx = await prisma.transaction.findUnique({
        where: { id: debitResult.transaction.id }
      });
      const finalWallet = await prisma.wallet.findUnique({
        where: { userId: wallet.userId }
      });

      return res.json({
        ok: true,
        transaction: updatedTx,
        wallet: {
          userId: wallet.userId,
          balanceKobo: finalWallet?.balanceKobo ?? debitResult.wallet.balanceKobo,
          currency: finalWallet?.currency ?? debitResult.wallet.currency
        }
      });
    } catch (err) {
      await prisma.$transaction(async (tx) => {
        await tx.wallet.update({
          where: { userId: wallet.userId },
          data: {
            balanceKobo: { increment: amountKobo }
          }
        });
        await tx.transaction.update({
          where: { id: debitResult.transaction.id },
          data: {
            status: "failed",
            metaJson: {
              ...(typeof debitResult.transaction.metaJson === "object" &&
              debitResult.transaction.metaJson !== null
                ? debitResult.transaction.metaJson
                : {}),
              vtuError: err instanceof Error ? err.message : err
            }
          }
        });
      });
      throw err;
    }
  })
);

export default router;
