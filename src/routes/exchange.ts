import path from "path";
import fs from "fs/promises";
import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import { prisma } from "../db";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError, notFound } from "../errors";
import { fxRates, getFxRate } from "../config/fxRates";
import { exchangePayTo } from "../config/exchangePayTo";
import { env } from "../config/env";
import { sendExchangeReceiptEmail } from "../services/emailService";
import { logWarn } from "../utils/logger";

const router = Router();

const RECEIPT_MAX_BYTES = 8 * 1024 * 1024;
const RECEIPTS_DIR = path.join(process.cwd(), "uploads", "exchange_receipts");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: RECEIPT_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    const allowedMime = new Set([
      "image/jpeg",
      "image/jpg",
      "image/png",
      "application/pdf"
    ]);
    const allowedExt = new Set([".jpg", ".jpeg", ".png", ".pdf"]);
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (allowedMime.has(file.mimetype) || allowedExt.has(ext)) {
      cb(null, true);
      return;
    }
    cb(new AppError(400, "Only JPG, PNG, or PDF files are allowed", "RECEIPT_INVALID"));
  }
});

const ensureAuth = (userId?: string) => {
  if (!userId) {
    throw new AppError(401, "Missing auth context", "AUTH_CONTEXT_MISSING");
  }
};

const normalizeCurrency = (value: string) => value.trim().toUpperCase();

const validatePair = (from: string, to: string) => {
  const fromCur = normalizeCurrency(from);
  const toCur = normalizeCurrency(to);
  if (fromCur === toCur) {
    throw new AppError(400, "Currencies must differ", "EXCHANGE_PAIR_INVALID");
  }
  if (
    !(
      (fromCur === "NGN" && toCur === "EUR") ||
      (fromCur === "EUR" && toCur === "NGN")
    )
  ) {
    throw new AppError(400, "Unsupported currency pair", "EXCHANGE_PAIR_INVALID");
  }
  return { fromCur, toCur };
};

const ensureReceiptsDir = async () => {
  await fs.mkdir(RECEIPTS_DIR, { recursive: true });
};

const buildReceiptFileName = (tradeId: string, ext: string) =>
  `${tradeId}_${Date.now()}${ext}`;

const toAmountMinor = (fromAmountMinor: number, rate: number) =>
  Math.floor(fromAmountMinor * rate);

const ngnReceivingSchema = z.object({
  bankName: z.string().min(1),
  accountNumber: z.string().regex(/^\d{10}$/),
  accountName: z.string().min(1)
});

const eurReceivingSchema = z.object({
  beneficiaryName: z.string().min(1),
  iban: z.string().min(8),
  swiftBic: z.string().min(6),
  bankName: z.string().min(1),
  bankAddress: z.string().min(1).optional(),
  beneficiaryAddress: z.string().min(1).optional()
});

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

const maybeExpireTrade = async (trade: any) => {
  if (trade.status !== "PENDING_PAYMENT") {
    return trade;
  }
  if (new Date(trade.expiresAt).getTime() <= Date.now()) {
    const updated = await prisma.exchangeTrade.update({
      where: { id: trade.id },
      data: { status: "EXPIRED" }
    });
    return updated;
  }
  return trade;
};

const ongoingStatuses = [
  "PENDING_PAYMENT",
  "PAID_AWAITING_CONFIRMATION",
  "PAYMENT_RECEIVED"
];

const findOngoingTrade = async (userId: string) => {
  const trades = await prisma.exchangeTrade.findMany({
    where: {
      userId,
      status: { in: ongoingStatuses }
    },
    orderBy: { createdAt: "desc" },
    take: 5
  });

  for (const trade of trades) {
    const updated = await maybeExpireTrade(trade);
    if (updated.status !== "EXPIRED") {
      return updated;
    }
  }
  return null;
};

const isAdminRequest = (req: any) => {
  const key = req.headers["x-admin-key"];
  if (!env.ADMIN_API_KEY || typeof key !== "string") return false;
  return key === env.ADMIN_API_KEY;
};

router.get(
  "/rates",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const query = z
      .object({
        from: z.string(),
        to: z.string(),
        amountMinor: z.coerce.number().int().positive().optional()
      })
      .parse(req.query);

    const { fromCur, toCur } = validatePair(query.from, query.to);
    const rate = getFxRate(fromCur, toCur);
    if (rate === null) {
      throw new AppError(400, "Rate not available", "EXCHANGE_RATE_MISSING");
    }

    const fromAmountMinor = query.amountMinor ?? 0;
    const computed = fromAmountMinor ? toAmountMinor(fromAmountMinor, rate) : 0;

    res.json({
      ok: true,
      fromCurrency: fromCur,
      toCurrency: toCur,
      rate,
      fromAmountMinor,
      toAmountMinor: computed,
      rateUpdatedAt: fxRates.updatedAt,
      note: "Rates set manually"
    });
  })
);

router.post(
  "/trades",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const body = z
      .object({
        fromCurrency: z.string(),
        toCurrency: z.string(),
        fromAmountMinor: z.coerce.number().int().positive(),
        receivingDetails: z.record(z.unknown())
      })
      .parse(req.body);

    const { fromCur, toCur } = validatePair(body.fromCurrency, body.toCurrency);
    const rate = getFxRate(fromCur, toCur);
    if (rate === null) {
      throw new AppError(400, "Rate not available", "EXCHANGE_RATE_MISSING");
    }

    const receivingDetails =
      toCur === "NGN"
        ? ngnReceivingSchema.parse(body.receivingDetails)
        : eurReceivingSchema.parse(body.receivingDetails);

    const payToDetails = (exchangePayTo as any)[fromCur];
    if (!payToDetails) {
      throw new AppError(400, "Pay-to details missing", "EXCHANGE_PAYTO_MISSING");
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const trade = await prisma.exchangeTrade.create({
      data: {
        userId: req.auth!.userId,
        fromCurrency: fromCur,
        toCurrency: toCur,
        fromAmountMinor: body.fromAmountMinor,
        toAmountMinor: toAmountMinor(body.fromAmountMinor, rate),
        rate,
        rateSource: "manual_config",
        status: "PENDING_PAYMENT",
        expiresAt,
        receivingDetailsJson: receivingDetails,
        payToDetailsJson: payToDetails
      }
    });

    res.json({
      ok: true,
      trade: serializeTrade(trade)
    });
  })
);

router.get(
  "/trades/ongoing",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const trade = await findOngoingTrade(req.auth!.userId);

    res.json({
      ok: true,
      trade: trade ? serializeTrade(trade) : null
    });
  })
);

router.get(
  "/trades/:id",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const trade = await prisma.exchangeTrade.findFirst({
      where: {
        id: req.params.id,
        userId: req.auth!.userId
      }
    });

    if (!trade) {
      throw notFound("Trade not found");
    }

    const updated = await maybeExpireTrade(trade);

    res.json({
      ok: true,
      trade: serializeTrade(updated)
    });
  })
);

router.post(
  "/trades/:id/cancel",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const trade = await prisma.exchangeTrade.findFirst({
      where: {
        id: req.params.id,
        userId: req.auth!.userId
      }
    });

    if (!trade) {
      throw notFound("Trade not found");
    }

    if (trade.status === "PENDING_PAYMENT" && trade.expiresAt.getTime() <= Date.now()) {
      await prisma.exchangeTrade.update({
        where: { id: trade.id },
        data: { status: "EXPIRED" }
      });
      throw new AppError(400, "Trade already expired", "EXCHANGE_EXPIRED");
    }

    if (trade.status !== "PENDING_PAYMENT") {
      throw new AppError(400, "Trade cannot be cancelled", "EXCHANGE_CANCEL_INVALID");
    }
    if (trade.receiptFileName || trade.receiptFileUrl) {
      throw new AppError(400, "Trade cannot be cancelled after receipt upload", "EXCHANGE_CANCEL_INVALID");
    }

    const now = new Date();
    const amountKobo =
      trade.fromCurrency === "NGN" ? trade.fromAmountMinor : trade.toAmountMinor;

    await prisma.$transaction(async (tx) => {
      await tx.transaction.create({
        data: {
          userId: trade.userId,
          type: "exchange",
          category: "exchange",
          amountKobo,
          feeKobo: 0,
          totalKobo: amountKobo,
          provider: "kobpay",
          providerRef: trade.id,
          status: "cancelled",
          metaJson: {
            tradeId: trade.id,
            pair: `${trade.fromCurrency}-${trade.toCurrency}`,
            fromCurrency: trade.fromCurrency,
            toCurrency: trade.toCurrency,
            fromAmountMinor: trade.fromAmountMinor,
            toAmountMinor: trade.toAmountMinor,
            rate: trade.rate,
            cancelledAt: now.toISOString(),
            receivingDetails: trade.receivingDetailsJson,
            payToDetails: trade.payToDetailsJson
          }
        }
      });

      await tx.exchangeTrade.delete({
        where: { id: trade.id }
      });
    });

    res.json({
      ok: true,
      status: "CANCELLED"
    });
  })
);

router.post(
  "/trades/:id/receipt",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const trade = await prisma.exchangeTrade.findFirst({
      where: {
        id: req.params.id,
        userId: req.auth!.userId
      }
    });

    if (!trade) {
      throw notFound("Trade not found");
    }

    const updatedTrade = await maybeExpireTrade(trade);
    if (updatedTrade.status !== "PENDING_PAYMENT") {
      throw new AppError(400, "Trade not eligible for receipt upload", "EXCHANGE_RECEIPT_INVALID");
    }
    if (updatedTrade.receiptFileName || updatedTrade.receiptFileUrl) {
      throw new AppError(400, "Receipt already uploaded", "EXCHANGE_RECEIPT_EXISTS");
    }

    const file = req.file;
    if (!file) {
      throw new AppError(400, "Receipt file is required", "RECEIPT_MISSING");
    }

    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    await ensureReceiptsDir();
    const fileName = buildReceiptFileName(trade.id, ext);
    const filePath = path.join(RECEIPTS_DIR, fileName);

    await fs.writeFile(filePath, file.buffer);

    const saved = await prisma.exchangeTrade.update({
      where: { id: trade.id },
      data: {
        receiptFileUrl: `/api/exchange/trades/${trade.id}/receipt`,
        receiptFileName: fileName,
        receiptMimeType: file.mimetype
      }
    });

    res.json({
      ok: true,
      receipt: {
        fileUrl: saved.receiptFileUrl,
        fileName: saved.receiptFileName,
        mimeType: saved.receiptMimeType
      }
    });
  })
);

router.post(
  "/trades/:id/paid",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const trade = await prisma.exchangeTrade.findFirst({
      where: {
        id: req.params.id,
        userId: req.auth!.userId
      }
    });

    if (!trade) {
      throw notFound("Trade not found");
    }

    if (trade.status === "PENDING_PAYMENT" && trade.expiresAt.getTime() <= Date.now()) {
      await prisma.exchangeTrade.update({
        where: { id: trade.id },
        data: { status: "EXPIRED" }
      });
      throw new AppError(400, "Trade already expired", "EXCHANGE_EXPIRED");
    }

    if (trade.status !== "PENDING_PAYMENT") {
      throw new AppError(400, "Trade cannot be marked as paid", "EXCHANGE_PAID_INVALID");
    }
    if (!trade.receiptFileName || !trade.receiptFileUrl) {
      throw new AppError(400, "Receipt is required", "EXCHANGE_RECEIPT_REQUIRED");
    }

    const updated = await prisma.exchangeTrade.update({
      where: { id: trade.id },
      data: {
        status: "PAID_AWAITING_CONFIRMATION",
        paidAt: new Date()
      }
    });

    try {
      await sendExchangeReceiptEmail({
        tradeId: updated.id,
        fromCurrency: updated.fromCurrency,
        toCurrency: updated.toCurrency,
        fromAmountMinor: updated.fromAmountMinor,
        toAmountMinor: updated.toAmountMinor,
        rate: updated.rate,
        createdAt: updated.createdAt,
        receivingDetails: updated.receivingDetailsJson,
        receiptFileName: updated.receiptFileName,
        receiptFileUrl: updated.receiptFileUrl,
        receiptMimeType: updated.receiptMimeType,
        receiptsDir: RECEIPTS_DIR
      });
    } catch (err) {
      logWarn("exchange_receipt_email_failed", { tradeId: updated.id });
    }

    res.json({
      ok: true,
      trade: serializeTrade(updated)
    });
  })
);

router.get(
  "/trades/:id/receipt",
  asyncHandler(async (req, res) => {
    const isAdmin = isAdminRequest(req);
    if (!isAdmin) {
      ensureAuth(req.auth?.userId);
    }

    const trade = await prisma.exchangeTrade.findFirst({
      where: {
        id: req.params.id,
        ...(isAdmin ? {} : { userId: req.auth!.userId })
      }
    });

    if (!trade) {
      throw notFound("Trade not found");
    }
    if (!trade.receiptFileName) {
      throw notFound("Receipt not found");
    }

    const filePath = path.join(RECEIPTS_DIR, trade.receiptFileName);
    res.setHeader("Content-Type", trade.receiptMimeType ?? "application/octet-stream");
    res.sendFile(filePath, (err) => {
      if (err) {
        logWarn("exchange_receipt_send_failed", {
          tradeId: trade.id,
          error: err.message
        });
      }
    });
  })
);

export default router;
