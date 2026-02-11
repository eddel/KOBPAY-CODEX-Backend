import crypto from "crypto";
import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { asyncHandler } from "../utils/asyncHandler";
import { env } from "../config/env";
import { AppError } from "../errors";
import { logInfo, logWarn } from "../utils/logger";

const router = Router();

const safeCompare = (a: string, b: string) => {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
};

const isValidFlutterwaveSignature = (rawBody: Buffer, signature: string, secret: string) => {
  const hash = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  return safeCompare(hash, signature);
};

const isValidPaystackSignature = (rawBody: Buffer, signature: string, secret: string) => {
  const hash = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  return safeCompare(hash, signature);
};

const extractEventType = (payload: any) => {
  return payload?.event ?? payload?.type ?? payload?.["event.type"];
};

const extractData = (payload: any) => {
  return payload?.data ?? payload;
};

const extractMeta = (payload: any, data: any) => {
  return (
    payload?.meta ??
    payload?.meta_data ??
    data?.meta ??
    data?.meta_data ??
    data?.metadata
  );
};

const extractTxRef = (data: any) => {
  return data?.tx_ref ?? data?.reference ?? data?.txRef;
};

const extractBillReference = (data: any) => {
  return data?.customer_reference ?? data?.reference ?? data?.tx_ref ?? data?.flw_ref;
};

const mapStatus = (value: string) => {
  const status = value.toLowerCase();
  if (["successful", "success", "completed"].includes(status)) {
    return "success";
  }
  if (["failed", "fail", "error", "cancelled", "canceled"].includes(status)) {
    return "failed";
  }
  if (!status) {
    return "pending";
  }
  return status;
};

const extractUserIdFromTxRef = (txRef?: string) => {
  if (!txRef) {
    return null;
  }
  const match = txRef.match(/^(?:va|wf)_([0-9a-fA-F-]{36})_/);
  return match ? match[1] : null;
};

const extractTransferReference = (data: any) => {
  return data?.reference ?? data?.tx_ref ?? data?.flw_ref ?? data?.id;
};

const normalizeAccountNumber = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const digits = String(value).replace(/\D/g, "");
  return digits.length ? digits : null;
};

const extractPaystackAccountNumber = (data: any) => {
  const candidates = [
    data?.authorization?.account_number,
    data?.authorization?.receiver_bank_account_number,
    data?.authorization?.sender_bank_account_number,
    data?.dedicated_account?.account_number,
    data?.bank?.account_number,
    data?.account_number,
    data?.accountNumber
  ];
  for (const candidate of candidates) {
    const normalized = normalizeAccountNumber(candidate);
    if (normalized) return normalized;
  }
  return null;
};

const mapVtuWebhookStatus = (value: string) => {
  const status = value.toLowerCase();
  if (status.includes("success") || status.includes("completed")) {
    return "success";
  }
  if (status.includes("fail") || status.includes("error")) {
    return "failed";
  }
  return "pending";
};

const toKobo = (value: unknown) => {
  const amount =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
  if (!Number.isFinite(amount)) {
    return 0;
  }
  return Math.round(amount * 100);
};

const handleFlutterwaveWebhook = async (req: any, res: any) => {
    if (env.FLW_WEBHOOK_SECRET) {
      const signatureHeader = req.headers["flutterwave-signature"];
      const legacyHeader = req.headers["verif-hash"];
      const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));

      if (typeof signatureHeader === "string") {
        const ok = isValidFlutterwaveSignature(rawBody, signatureHeader, env.FLW_WEBHOOK_SECRET);
        if (!ok) {
          throw new AppError(401, "Invalid webhook signature", "WEBHOOK_INVALID");
        }
      } else if (typeof legacyHeader === "string") {
        if (!safeCompare(env.FLW_WEBHOOK_SECRET, legacyHeader)) {
          throw new AppError(401, "Invalid webhook signature", "WEBHOOK_INVALID");
        }
      } else {
        throw new AppError(401, "Missing webhook signature", "WEBHOOK_INVALID");
      }
    }

    const payload = req.body ?? {};
    const data = extractData(payload);
    const eventType = String(extractEventType(payload) ?? "unknown");
    const status = String(data?.status ?? payload?.status ?? "").toLowerCase();
    const txRef = extractTxRef(data);
    const providerRef =
      data?.id ?? data?.flw_ref ?? data?.reference ?? txRef ?? payload?.id ?? "unknown";
    const reference =
      providerRef === "unknown"
        ? `unknown_${Date.now()}_${crypto.randomUUID()}`
        : String(providerRef);

    logInfo("flutterwave_webhook_received", {
      eventType,
      providerRef,
      reference
    });

    let webhookEventId: string | null = null;
    try {
      const created = await prisma.webhookEvent.create({
        data: {
          provider: "flutterwave",
          eventType,
          reference: reference,
          payloadJson: payload,
          status: "RECEIVED"
        }
      });
      webhookEventId = created.id;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return res.status(200).json({ ok: true, duplicate: true });
      }
      throw err;
    }

    const normalizedEvent = eventType.toLowerCase();
    if (normalizedEvent === "singlebillpayment.status") {
      const billReference = extractBillReference(data);
      if (!billReference) {
        logWarn("flutterwave_bill_webhook_missing_reference", {
          eventType,
          providerRef
        });
        if (webhookEventId) {
          await prisma.webhookEvent.update({
            where: { id: webhookEventId },
            data: {
              processedAt: new Date(),
              status: "UNMATCHED"
            }
          });
        }
        return res.status(200).json({ ok: true, unmatched: true });
      }

      const transactionRecord = await prisma.transaction.findFirst({
        where: {
          provider: "flutterwave",
          providerRef: String(billReference)
        }
      });

      if (!transactionRecord) {
        if (webhookEventId) {
          await prisma.webhookEvent.update({
            where: { id: webhookEventId },
            data: {
              processedAt: new Date(),
              status: "UNMATCHED"
            }
          });
        }
        return res.status(200).json({ ok: true, unmatched: true });
      }

      const mappedStatus = mapStatus(String(data?.status ?? ""));

      await prisma.$transaction(async (tx) => {
        await tx.transaction.update({
          where: { id: transactionRecord.id },
          data: {
            status: mappedStatus,
            metaJson: {
              ...(typeof transactionRecord.metaJson === "object" &&
              transactionRecord.metaJson !== null
                ? transactionRecord.metaJson
                : {}),
              flutterwaveWebhook: payload
            }
          }
        });

        if (mappedStatus === "failed") {
          await tx.wallet.update({
            where: { userId: transactionRecord.userId },
            data: {
              balanceKobo: { increment: transactionRecord.amountKobo }
            }
          });
        }

        if (webhookEventId) {
          await tx.webhookEvent.update({
            where: { id: webhookEventId },
            data: {
              processedAt: new Date(),
              status: mappedStatus === "failed" ? "FAILED" : "PROCESSED"
            }
          });
        }
      });

      return res.status(200).json({ ok: true });
    }

    if (
      normalizedEvent === "transfer.completed" ||
      normalizedEvent === "transfer.failed" ||
      normalizedEvent === "transfer.status"
    ) {
      const transferRef = extractTransferReference(data);
      if (!transferRef) {
        if (webhookEventId) {
          await prisma.webhookEvent.update({
            where: { id: webhookEventId },
            data: {
              processedAt: new Date(),
              status: "UNMATCHED"
            }
          });
        }
        return res.status(200).json({ ok: true, unmatched: true });
      }

      const transactionRecord = await prisma.transaction.findFirst({
        where: {
          provider: "flutterwave",
          providerRef: String(transferRef),
          category: "withdrawal"
        }
      });

      if (!transactionRecord) {
        if (webhookEventId) {
          await prisma.webhookEvent.update({
            where: { id: webhookEventId },
            data: {
              processedAt: new Date(),
              status: "UNMATCHED"
            }
          });
        }
        return res.status(200).json({ ok: true, unmatched: true });
      }

      const mappedStatus = mapStatus(String(data?.status ?? normalizedEvent));

      await prisma.$transaction(async (tx) => {
        await tx.transaction.update({
          where: { id: transactionRecord.id },
          data: {
            status: mappedStatus,
            metaJson: {
              ...(typeof transactionRecord.metaJson === "object" &&
              transactionRecord.metaJson !== null
                ? transactionRecord.metaJson
                : {}),
              flutterwaveWebhook: payload
            }
          }
        });

        if (mappedStatus === "failed" && transactionRecord.status !== "failed") {
          await tx.wallet.update({
            where: { userId: transactionRecord.userId },
            data: {
              balanceKobo: { increment: transactionRecord.amountKobo }
            }
          });
        }

        if (webhookEventId) {
          await tx.webhookEvent.update({
            where: { id: webhookEventId },
            data: {
              processedAt: new Date(),
              status: mappedStatus === "failed" ? "FAILED" : "PROCESSED"
            }
          });
        }
      });

      return res.status(200).json({ ok: true });
    }

    const successStatuses = new Set(["successful", "success", "succeeded"]);
    if (normalizedEvent !== "charge.completed" || !successStatuses.has(status)) {
      if (webhookEventId) {
        await prisma.webhookEvent.update({
          where: { id: webhookEventId },
          data: {
            processedAt: new Date(),
            status: "IGNORED"
          }
        });
      }
      return res.status(200).json({ ok: true, ignored: true });
    }

    const meta = extractMeta(payload, data);
    let userId = extractUserIdFromTxRef(txRef);
    if (!userId && meta && typeof meta === "object" && "userId" in meta) {
      const maybeId = (meta as any).userId;
      if (typeof maybeId === "string") {
        userId = maybeId;
      }
    }

    if (!userId) {
      console.warn("Flutterwave webhook userId not found", {
        eventType,
        txRef,
        providerRef,
        meta
      });
      if (webhookEventId) {
        await prisma.webhookEvent.update({
          where: { id: webhookEventId },
          data: {
            processedAt: new Date(),
            status: "UNMATCHED"
          }
        });
      }
      return res.status(200).json({ ok: true, unmatched: true });
    }

    const amountKobo = toKobo(data?.amount);
    const feeKobo = toKobo(data?.app_fee ?? data?.fee ?? 0);
    const totalKobo = amountKobo + feeKobo;
    const currency = String(data?.currency ?? env.FLW_CURRENCY ?? "NGN");

    await prisma.$transaction(async (tx) => {
      await tx.wallet.upsert({
        where: { userId },
        create: {
          userId,
          balanceKobo: amountKobo,
          currency
        },
        update: {
          balanceKobo: { increment: amountKobo },
          currency
        }
      });

      try {
        await tx.transaction.create({
          data: {
            userId,
            type: "credit",
            category: "wallet_funding",
            amountKobo,
            feeKobo,
            totalKobo,
            provider: "flutterwave",
            providerRef: String(providerRef),
            status: status,
            metaJson: payload
          }
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          return;
        }
        throw err;
      }

      if (webhookEventId) {
        await tx.webhookEvent.update({
          where: { id: webhookEventId },
          data: {
            processedAt: new Date(),
            status: "PROCESSED"
          }
        });
      }
    });

    return res.status(200).json({ ok: true });
};

const handlePaystackWebhook = async (req: any, res: any) => {
    if (env.PAYSTACK_WEBHOOK_SECRET) {
      const signatureHeader = req.headers["x-paystack-signature"];
      const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));

      if (typeof signatureHeader === "string") {
        const ok = isValidPaystackSignature(rawBody, signatureHeader, env.PAYSTACK_WEBHOOK_SECRET);
        if (!ok) {
          throw new AppError(401, "Invalid webhook signature", "WEBHOOK_INVALID");
        }
      } else {
        throw new AppError(401, "Missing webhook signature", "WEBHOOK_INVALID");
      }
    }

    const payload = req.body ?? {};
    const data = payload?.data ?? {};
    const eventType = String(payload?.event ?? "unknown");
    const status = String(data?.status ?? "").toLowerCase();
    const providerRef = String(
      data?.reference ?? data?.id ?? payload?.id ?? `unknown_${Date.now()}_${crypto.randomUUID()}`
    );

    logInfo("paystack_webhook_received", {
      eventType,
      providerRef
    });

    let webhookEventId: string | null = null;
    try {
      const created = await prisma.webhookEvent.create({
        data: {
          provider: "paystack",
          eventType,
          reference: providerRef,
          payloadJson: payload,
          status: "RECEIVED"
        }
      });
      webhookEventId = created.id;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return res.status(200).json({ ok: true, duplicate: true });
      }
      throw err;
    }

    if (eventType.toLowerCase() !== "charge.success" || status !== "success") {
      if (webhookEventId) {
        await prisma.webhookEvent.update({
          where: { id: webhookEventId },
          data: {
            processedAt: new Date(),
            status: "IGNORED"
          }
        });
      }
      return res.status(200).json({ ok: true, ignored: true });
    }

    const customerCode = String(data?.customer?.customer_code ?? "");
    const metaUserId =
      data?.metadata && typeof data.metadata === "object" && "userId" in data.metadata
        ? String((data.metadata as any).userId)
        : null;
    const accountNumber = extractPaystackAccountNumber(data);

    let userId: string | null = null;
    if (customerCode) {
      const wallet = await prisma.wallet.findFirst({
        where: {
          paystackCustomerCode: customerCode
        }
      });
      userId = wallet?.userId ?? null;
    }
    if (!userId && metaUserId) {
      userId = metaUserId;
    }
    if (!userId && accountNumber) {
      const wallet = await prisma.wallet.findFirst({
        where: {
          virtualAccountNumber: accountNumber
        }
      });
      userId = wallet?.userId ?? null;
    }

    if (!userId) {
      logWarn("paystack_webhook_user_not_found", {
        eventType,
        providerRef,
        customerCode,
        accountNumber
      });
      if (webhookEventId) {
        await prisma.webhookEvent.update({
          where: { id: webhookEventId },
          data: {
            processedAt: new Date(),
            status: "UNMATCHED"
          }
        });
      }
      return res.status(200).json({ ok: true, unmatched: true });
    }

    const amountKobo = Number(data?.amount ?? 0);
    const feeKobo = Number(data?.fees ?? 0);
    const totalKobo = amountKobo + feeKobo;
    const currency = String(data?.currency ?? env.FLW_CURRENCY ?? "NGN").toUpperCase();

    await prisma.$transaction(async (tx) => {
      await tx.wallet.upsert({
        where: { userId },
        create: {
          userId,
          balanceKobo: amountKobo,
          currency
        },
        update: {
          balanceKobo: { increment: amountKobo },
          currency
        }
      });

      try {
        await tx.transaction.create({
          data: {
            userId,
            type: "credit",
            category: "wallet_funding",
            amountKobo,
            feeKobo,
            totalKobo,
            provider: "paystack",
            providerRef: providerRef,
            status: "success",
            metaJson: payload
          }
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          return;
        }
        throw err;
      }

      if (webhookEventId) {
        await tx.webhookEvent.update({
          where: { id: webhookEventId },
          data: {
            processedAt: new Date(),
            status: "PROCESSED"
          }
        });
      }
    });

    return res.status(200).json({ ok: true });
};

const handleVtuWebhook = async (req: any, res: any) => {
    const payload = req.body ?? {};
    const apiKeyHash = payload?.apikey ? String(payload.apikey) : null;
    if (env.VTU_API_KEY && apiKeyHash) {
      const expected = crypto.createHash("md5").update(env.VTU_API_KEY).digest("hex");
      if (!safeCompare(expected, apiKeyHash)) {
        throw new AppError(401, "Invalid webhook signature", "WEBHOOK_INVALID");
      }
    }

    const reference = String(payload?.ref ?? payload?.reference ?? payload?.transaction_id ?? "");
    if (!reference) {
      return res.status(200).json({ ok: true, unmatched: true });
    }

    const statusRaw = String(payload?.status ?? "");
    const mappedStatus = mapVtuWebhookStatus(statusRaw);

    let webhookEventId: string | null = null;
    try {
      const created = await prisma.webhookEvent.create({
        data: {
          provider: "vtuafrica",
          eventType: "transaction",
          reference,
          payloadJson: payload,
          status: "RECEIVED"
        }
      });
      webhookEventId = created.id;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return res.status(200).json({ ok: true, duplicate: true });
      }
      throw err;
    }

    const transactionRecord = await prisma.transaction.findFirst({
      where: {
        provider: "vtuafrica",
        providerRef: reference,
        category: "bills"
      }
    });

    if (!transactionRecord) {
      if (webhookEventId) {
        await prisma.webhookEvent.update({
          where: { id: webhookEventId },
          data: {
            processedAt: new Date(),
            status: "UNMATCHED"
          }
        });
      }
      return res.status(200).json({ ok: true, unmatched: true });
    }

    await prisma.$transaction(async (tx) => {
      await tx.transaction.update({
        where: { id: transactionRecord.id },
        data: {
          status: mappedStatus,
          metaJson: {
            ...(typeof transactionRecord.metaJson === "object" &&
            transactionRecord.metaJson !== null
              ? transactionRecord.metaJson
              : {}),
            vtuWebhook: payload
          }
        }
      });

      if (mappedStatus === "failed") {
        await tx.wallet.update({
          where: { userId: transactionRecord.userId },
          data: {
            balanceKobo: { increment: transactionRecord.amountKobo }
          }
        });
      }

      if (webhookEventId) {
        await tx.webhookEvent.update({
          where: { id: webhookEventId },
          data: {
            processedAt: new Date(),
            status: mappedStatus === "failed" ? "FAILED" : "PROCESSED"
          }
        });
      }
    });

    return res.status(200).json({ ok: true });
};

router.post(
  "/flutterwave",
  asyncHandler(async (req, res) => {
    await handleFlutterwaveWebhook(req, res);
  })
);

router.post(
  "/paystack",
  asyncHandler(async (req, res) => {
    await handlePaystackWebhook(req, res);
  })
);

router.post(
  "/vtuafrica",
  asyncHandler(async (req, res) => {
    await handleVtuWebhook(req, res);
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const hasPaystackSignature = typeof req.headers["x-paystack-signature"] === "string";
    const hasFlwSignature = typeof req.headers["flutterwave-signature"] === "string";
    const hasFlwLegacy = typeof req.headers["verif-hash"] === "string";
    const hasVtuKey = req.body?.apikey != null;

    if (hasPaystackSignature) {
      await handlePaystackWebhook(req, res);
      return;
    }
    if (hasFlwSignature || hasFlwLegacy) {
      await handleFlutterwaveWebhook(req, res);
      return;
    }
    if (hasVtuKey) {
      await handleVtuWebhook(req, res);
      return;
    }

    throw new AppError(400, "Unsupported webhook payload", "WEBHOOK_UNSUPPORTED");
  })
);

export default router;
