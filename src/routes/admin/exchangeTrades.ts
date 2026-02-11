import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db";
import { asyncHandler } from "../../utils/asyncHandler";
import { AppError, notFound } from "../../errors";
import { env } from "../../config/env";

const router = Router();

const ensureAdmin = (req: any) => {
  const key = req.headers["x-admin-key"];
  if (!env.ADMIN_API_KEY || typeof key !== "string" || key !== env.ADMIN_API_KEY) {
    throw new AppError(401, "Invalid admin key", "ADMIN_KEY_INVALID");
  }
};

const allowedStatuses = new Set([
  "PENDING_PAYMENT",
  "PAID_AWAITING_CONFIRMATION",
  "PAYMENT_RECEIVED",
  "EXCHANGE_COMPLETED",
  "EXPIRED",
  "CANCELLED"
]);

const serializeTrade = (trade: any) => ({
  id: trade.id,
  userId: trade.userId,
  fromCurrency: trade.fromCurrency,
  toCurrency: trade.toCurrency,
  fromAmountMinor: trade.fromAmountMinor,
  toAmountMinor: trade.toAmountMinor,
  rate: trade.rate,
  rateSource: trade.rateSource,
  status: trade.status,
  expiresAt: trade.expiresAt,
  paidAt: trade.paidAt,
  paymentReceivedAt: trade.paymentReceivedAt,
  completedAt: trade.completedAt,
  cancelledAt: trade.cancelledAt,
  receivingDetailsJson: trade.receivingDetailsJson,
  payToDetailsJson: trade.payToDetailsJson,
  receiptFileUrl: trade.receiptFileUrl,
  receiptFileName: trade.receiptFileName,
  receiptMimeType: trade.receiptMimeType,
  createdAt: trade.createdAt
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    ensureAdmin(req);

    const query = z
      .object({
        status: z.string().optional()
      })
      .parse(req.query);

    const status = query.status ? query.status.toUpperCase() : undefined;
    if (status && !allowedStatuses.has(status)) {
      throw new AppError(400, "Invalid status filter", "EXCHANGE_STATUS_INVALID");
    }

    const trades = await prisma.exchangeTrade.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: "desc" }
    });

    res.json({
      ok: true,
      trades: trades.map(serializeTrade)
    });
  })
);

router.post(
  "/:id/payment-received",
  asyncHandler(async (req, res) => {
    ensureAdmin(req);

    const trade = await prisma.exchangeTrade.findUnique({
      where: { id: req.params.id }
    });

    if (!trade) {
      throw notFound("Trade not found");
    }

    if (trade.status !== "PAID_AWAITING_CONFIRMATION") {
      throw new AppError(400, "Trade not eligible for payment received", "EXCHANGE_STATUS_INVALID");
    }

    const updated = await prisma.exchangeTrade.update({
      where: { id: trade.id },
      data: {
        status: "PAYMENT_RECEIVED",
        paymentReceivedAt: new Date()
      }
    });

    res.json({
      ok: true,
      trade: serializeTrade(updated)
    });
  })
);

router.post(
  "/:id/complete",
  asyncHandler(async (req, res) => {
    ensureAdmin(req);

    const trade = await prisma.exchangeTrade.findUnique({
      where: { id: req.params.id }
    });

    if (!trade) {
      throw notFound("Trade not found");
    }

    if (trade.status !== "PAYMENT_RECEIVED") {
      throw new AppError(400, "Trade not eligible for completion", "EXCHANGE_STATUS_INVALID");
    }

    const now = new Date();
    const amountKobo =
      trade.fromCurrency === "NGN" ? trade.fromAmountMinor : trade.toAmountMinor;

    const completed = await prisma.$transaction(async (tx) => {
      const updated = await tx.exchangeTrade.update({
        where: { id: trade.id },
        data: {
          status: "EXCHANGE_COMPLETED",
          completedAt: now
        }
      });

      await tx.transaction.create({
        data: {
          userId: updated.userId,
          type: "exchange",
          category: "exchange",
          amountKobo,
          feeKobo: 0,
          totalKobo: amountKobo,
          provider: "kobpay",
          providerRef: updated.id,
          status: "successful",
          metaJson: {
            tradeId: updated.id,
            pair: `${updated.fromCurrency}-${updated.toCurrency}`,
            fromCurrency: updated.fromCurrency,
            toCurrency: updated.toCurrency,
            fromAmountMinor: updated.fromAmountMinor,
            toAmountMinor: updated.toAmountMinor,
            rate: updated.rate,
            completedAt: now.toISOString(),
            receivingDetails: updated.receivingDetailsJson,
            receiptFileUrl: updated.receiptFileUrl ?? null,
            receiptFileName: updated.receiptFileName ?? null,
            receiptMimeType: updated.receiptMimeType ?? null
          }
        }
      });

      return updated;
    });

    res.json({
      ok: true,
      trade: serializeTrade(completed)
    });
  })
);

export default router;
