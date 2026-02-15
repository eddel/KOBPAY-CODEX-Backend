import crypto from "crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../errors.js";
import { env } from "../config/env.js";
import { createTransfer, resolveBankAccount } from "../services/flutterwaveTransfersService.js";
import { asJson } from "../utils/prismaJson.js";

const router = Router();

const ensureAuth = (userId?: string) => {
  if (!userId) {
    throw new AppError(401, "Missing auth context", "AUTH_CONTEXT_MISSING");
  }
};

const toKobo = (amount?: number, amountKobo?: number) => {
  if (amountKobo && amountKobo > 0) {
    return amountKobo;
  }
  if (amount && amount > 0) {
    return Math.round(amount * 100);
  }
  return 0;
};

const extractIdempotencyKey = (req: { headers: Record<string, unknown> }) => {
  const headerKey =
    (req.headers["x-idempotency-key"] as string | undefined) ??
    (req.headers["idempotency-key"] as string | undefined);
  return headerKey?.trim() || undefined;
};

router.post(
  "/",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const body = z
      .object({
        amount: z.coerce.number().positive().optional(),
        amountKobo: z.coerce.number().int().positive().optional(),
        bankCode: z.string().min(2),
        accountNumber: z.string().min(6),
        narration: z.string().max(140).optional(),
        reference: z.string().min(6).optional(),
        resolve: z.coerce.boolean().optional(),
        saveBeneficiary: z.coerce.boolean().optional()
      })
      .refine((data) => data.amount !== undefined || data.amountKobo !== undefined, {
        message: "amount or amountKobo is required"
      })
      .parse(req.body);

    const amountKobo = toKobo(body.amount, body.amountKobo);
    if (!amountKobo || amountKobo <= 0) {
      throw new AppError(400, "Amount must be greater than zero", "AMOUNT_REQUIRED");
    }

    const wallet = await prisma.wallet.findUnique({ where: { userId: req.auth!.userId } });
    if (!wallet || wallet.balanceKobo < amountKobo) {
      throw new AppError(400, "Insufficient wallet balance", "INSUFFICIENT_FUNDS");
    }

    const idempotencyKey = extractIdempotencyKey(req);
    const reference = body.reference ?? idempotencyKey ?? `wd_${crypto.randomUUID()}`;

    const existing = await prisma.transaction.findFirst({
      where: {
        userId: req.auth!.userId,
        provider: "flutterwave",
        providerRef: reference,
        category: "withdrawal"
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

    let accountName: string | undefined;
    if (body.resolve) {
      const resolved = await resolveBankAccount(body.accountNumber, body.bankCode);
      accountName = resolved?.account_name ?? resolved?.accountName;
      if (body.saveBeneficiary) {
        await prisma.bankAccount.upsert({
          where: {
            userId_bankCode_accountNumber: {
              userId: req.auth!.userId,
              bankCode: body.bankCode,
              accountNumber: body.accountNumber
            }
          },
          update: {
            accountNameResolved: accountName || undefined
          },
          create: {
            userId: req.auth!.userId,
            bankCode: body.bankCode,
            bankName: resolved?.bank_name ?? resolved?.name ?? "",
            accountNumber: body.accountNumber,
            accountNameResolved: accountName || null
          }
        });
      }
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
          category: "withdrawal",
          amountKobo,
          feeKobo: 0,
          totalKobo: amountKobo,
          provider: "flutterwave",
          providerRef: reference,
          status: "pending",
          metaJson: asJson({
            bankCode: body.bankCode,
            accountNumber: body.accountNumber,
            accountName: accountName ?? null,
            narration: body.narration ?? null,
            reference
          })
        }
      });

      return { transaction, wallet: updatedWallet };
    });

    try {
      const amount = Number((amountKobo / 100).toFixed(2));
      const transfer = await createTransfer({
        amount,
        currency: (wallet.currency ?? env.FLW_CURRENCY).toUpperCase(),
        accountBank: body.bankCode,
        accountNumber: body.accountNumber,
        narration: body.narration,
        reference,
        meta: {
          userId: req.auth!.userId
        },
        idempotencyKey
      });

      const statusRaw = String((transfer as any)?.status ?? "").toLowerCase();
      const status =
        statusRaw.includes("success") || statusRaw.includes("completed")
          ? "success"
          : statusRaw.includes("fail") || statusRaw.includes("error")
            ? "failed"
            : "pending";

      await prisma.transaction.update({
        where: { id: debitResult.transaction.id },
        data: {
          status,
          metaJson: asJson({
            ...(typeof debitResult.transaction.metaJson === "object" &&
            debitResult.transaction.metaJson !== null
              ? debitResult.transaction.metaJson
              : {}),
            flutterwave: transfer
          })
        }
      });

      if (status === "failed") {
        await prisma.wallet.update({
          where: { userId: wallet.userId },
          data: {
            balanceKobo: { increment: amountKobo }
          }
        });
      }

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
            metaJson: asJson({
              ...(typeof debitResult.transaction.metaJson === "object" &&
              debitResult.transaction.metaJson !== null
                ? debitResult.transaction.metaJson
                : {}),
              flutterwaveError: err instanceof Error ? err.message : err
            })
          }
        });
      });
      throw err;
    }
  })
);

export default router;

