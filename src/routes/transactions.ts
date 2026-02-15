import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError, notFound } from "../errors.js";
import { getBillStatus, toBillStatus } from "../services/vtuAfricaBillsService.js";
import { logInfo, logWarn } from "../utils/logger.js";
import { asJson } from "../utils/prismaJson.js";

const router = Router();

const ensureAuth = (userId?: string) => {
  if (!userId) {
    throw new AppError(401, "Missing auth context", "AUTH_CONTEXT_MISSING");
  }
};

const buildReceipt = (tx: {
  id: string;
  type: string;
  category: string;
  amountKobo: number;
  feeKobo: number;
  totalKobo: number;
  provider: string;
  providerRef: string | null;
  status: string;
  createdAt: Date;
  metaJson: unknown | null;
}) => ({
  id: tx.id,
  reference: tx.providerRef ?? tx.id,
  type: tx.type,
  category: tx.category,
  amountKobo: tx.amountKobo,
  feeKobo: tx.feeKobo,
  totalKobo: tx.totalKobo,
  provider: tx.provider,
  status: tx.status,
  createdAt: tx.createdAt,
  meta: tx.metaJson ?? null
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const query = z
      .object({
        limit: z.coerce.number().int().min(1).max(100).optional(),
        cursor: z.string().uuid().optional()
      })
      .parse(req.query);

    const limit = query.limit ?? 20;

    const transactions = await prisma.transaction.findMany({
      where: { userId: req.auth!.userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {})
    });

    const nextCursor =
      transactions.length === limit ? transactions[transactions.length - 1]?.id : null;

    res.json({
      ok: true,
      transactions,
      nextCursor
    });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const transaction = await prisma.transaction.findFirst({
      where: {
        id: req.params.id,
        userId: req.auth!.userId
      }
    });

    if (!transaction) {
      throw notFound("Transaction not found");
    }

    res.json({ ok: true, transaction });
  })
);

router.get(
  "/:id/receipt",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const transaction = await prisma.transaction.findFirst({
      where: {
        id: req.params.id,
        userId: req.auth!.userId
      }
    });

    if (!transaction) {
      throw notFound("Transaction not found");
    }

    res.json({ ok: true, receipt: buildReceipt(transaction) });
  })
);

router.post(
  "/:id/refresh",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const transaction = await prisma.transaction.findFirst({
      where: {
        id: req.params.id,
        userId: req.auth!.userId
      }
    });

    if (!transaction) {
      throw notFound("Transaction not found");
    }

    if (transaction.provider !== "vtuafrica" || transaction.category !== "bills") {
      throw new AppError(400, "Transaction not eligible for refresh", "TX_REFRESH_INVALID");
    }

    if (!transaction.providerRef) {
      throw new AppError(400, "Missing provider reference", "TX_REFRESH_MISSING_REF");
    }

    logInfo("bill_status_refresh_request", {
      requestId: req.requestId,
      transactionId: transaction.id,
      providerRef: transaction.providerRef
    });

    const statusData = await getBillStatus(transaction.providerRef, {
      requestId: req.requestId
    });
    let mappedStatus = toBillStatus(statusData as any);
    if (["success", "failed"].includes(transaction.status)) {
      mappedStatus = transaction.status;
    }

    if (mappedStatus === "pending") {
      const statusRaw = String(
        (statusData as any)?.description?.Status ??
          (statusData as any)?.description?.status ??
          (statusData as any)?.status ??
          (statusData as any)?.message ??
          ""
      );
      logWarn("bill_status_pending_or_unknown", {
        requestId: req.requestId,
        transactionId: transaction.id,
        statusRaw
      });
    }

    let updatedTx = transaction;
    await prisma.$transaction(async (tx) => {
      const updated = await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          status: mappedStatus,
          metaJson: asJson({
            ...(typeof transaction.metaJson === "object" &&
            transaction.metaJson !== null
              ? transaction.metaJson
              : {}),
            vtuStatus: statusData
          })
        }
      });
      updatedTx = updated;

      if (mappedStatus === "failed" && transaction.status !== "failed") {
        await tx.wallet.update({
          where: { userId: transaction.userId },
          data: {
            balanceKobo: { increment: transaction.amountKobo }
          }
        });
      }
    });

    const wallet = await prisma.wallet.findUnique({
      where: { userId: transaction.userId }
    });

    res.json({
      ok: true,
      transaction: updatedTx,
      wallet: wallet
        ? {
            userId: wallet.userId,
            balanceKobo: wallet.balanceKobo,
            currency: wallet.currency
          }
        : null
    });
  })
);

export default router;

