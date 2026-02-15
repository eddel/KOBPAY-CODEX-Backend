import crypto from "crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../errors";
import { env } from "../config/env";
import { createReeplayCard } from "../services/reeplayService";
import { asJson } from "../utils/prismaJson";

const router = Router();

const ensureAuth = (userId?: string) => {
  if (!userId) {
    throw new AppError(401, "Missing auth context", "AUTH_CONTEXT_MISSING");
  }
};

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

const toKobo = (amount?: number, amountKobo?: number) => {
  if (amountKobo && amountKobo > 0) {
    return amountKobo;
  }
  if (amount && amount > 0) {
    return Math.round(amount * 100);
  }
  return 0;
};

router.post(
  "/purchase",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const body = z
      .object({
        amount: z.coerce.number().positive().optional(),
        amountKobo: z.coerce.number().int().positive().optional(),
        currency: z.string().min(3).max(3).optional(),
        recipientEmail: z.string().email().optional(),
        note: z.string().max(200).optional()
      })
      .refine((data) => data.amount !== undefined || data.amountKobo !== undefined, {
        message: "amount or amountKobo is required"
      })
      .parse(req.body);

    const amountKobo = toKobo(body.amount, body.amountKobo);
    if (!amountKobo || amountKobo <= 0) {
      throw new AppError(400, "Amount must be greater than zero", "AMOUNT_REQUIRED");
    }

    const wallet = await getOrCreateWallet(req.auth!.userId);
    if (wallet.balanceKobo < amountKobo) {
      throw new AppError(400, "Insufficient wallet balance", "INSUFFICIENT_FUNDS");
    }

    const idempotencyKey =
      (req.headers["x-idempotency-key"] as string | undefined) ??
      (req.headers["idempotency-key"] as string | undefined);
    const reference = idempotencyKey ?? `gift_${crypto.randomUUID()}`;

    const existing = await prisma.transaction.findFirst({
      where: {
        userId: wallet.userId,
        provider: "reeplay",
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
          category: "giftcard",
          amountKobo,
          feeKobo: 0,
          totalKobo: amountKobo,
          provider: "reeplay",
          providerRef: reference,
          status: "pending",
          metaJson: asJson({
            reference,
            amountKobo,
            currency: (body.currency ?? wallet.currency ?? env.FLW_CURRENCY).toUpperCase(),
            recipientEmail: body.recipientEmail ?? null,
            note: body.note ?? null
          })
        }
      });

      return { transaction, wallet: updatedWallet };
    });

    try {
      const amount = Number((amountKobo / 100).toFixed(2));
      const card = await createReeplayCard({
        amount,
        currency: (body.currency ?? wallet.currency ?? env.FLW_CURRENCY).toUpperCase(),
        recipientEmail: body.recipientEmail,
        note: body.note,
        reference
      });

      await prisma.transaction.update({
        where: { id: debitResult.transaction.id },
        data: {
          status: "success",
          metaJson: asJson({
            ...(typeof debitResult.transaction.metaJson === "object" &&
            debitResult.transaction.metaJson !== null
              ? debitResult.transaction.metaJson
              : {}),
            reeplay: card
          })
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
        },
        card
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
              reeplayError: err instanceof Error ? err.message : err
            })
          }
        });
      });
      throw err;
    }
  })
);

export default router;
