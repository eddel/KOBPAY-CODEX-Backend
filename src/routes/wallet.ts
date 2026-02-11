import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError, notFound } from "../errors";
import { env } from "../config/env";
import {
  createPaymentLink,
  verifyTransactionByReference
} from "../services/flutterwaveService";
import {
  createDedicatedAccount,
  createPaystackCustomer
} from "../services/paystackService";

const router = Router();

const ensureAuth = (userId?: string) => {
  if (!userId) {
    throw new AppError(401, "Missing auth context", "AUTH_CONTEXT_MISSING");
  }
};

const createWalletIfMissing = async (userId: string) => {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (wallet) {
    return wallet;
  }
  return prisma.wallet.create({
    data: {
      userId,
      balanceKobo: 0,
      currency: env.FLW_CURRENCY
    }
  });
};

const extractUserIdFromTxRef = (txRef?: string) => {
  if (!txRef) {
    return null;
  }
  const match = txRef.match(/^(?:va|wf)_([0-9a-fA-F-]{36})_/);
  return match ? match[1] : null;
};

const toKobo = (value: unknown) => {
  const amount =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
  if (!Number.isFinite(amount)) {
    return 0;
  }
  return Math.round(amount * 100);
};

router.get(
  "/",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const user = await prisma.user.findUnique({
      where: { id: req.auth!.userId }
    });

    if (!user) {
      throw notFound("User not found");
    }

    const wallet = await createWalletIfMissing(user.id);

    res.json({
      ok: true,
      wallet: {
        userId: wallet.userId,
        balanceKobo: wallet.balanceKobo,
        currency: wallet.currency,
        virtualAccount: wallet.virtualAccountNumber
          ? {
              accountNumber: wallet.virtualAccountNumber,
              bankName: wallet.virtualAccountBankName,
              accountName: wallet.virtualAccountAccountName
            }
          : null
      }
    });
  })
);

router.post(
  "/virtual-account",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const body = z
      .object({
        email: z.string().email().optional(),
        firstName: z.string().min(1).max(50).optional(),
        lastName: z.string().min(1).max(50).optional(),
        currency: z.string().min(3).max(3).optional(),
        amount: z.coerce.number().positive().optional(),
        amountKobo: z.coerce.number().int().positive().optional()
      })
      .parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.auth!.userId }
    });

    if (!user) {
      throw notFound("User not found");
    }

    const wallet = await createWalletIfMissing(user.id);

    const emailToUse = body.email ?? user.email ?? null;
    if (!emailToUse) {
      throw new AppError(400, "Email is required to create a virtual account", "EMAIL_REQUIRED");
    }

    if (body.email && body.email !== user.email) {
      await prisma.user.update({
        where: { id: user.id },
        data: { email: body.email }
      });
    }

    const amountKobo = body.amountKobo ?? (body.amount ? Math.round(body.amount * 100) : 0);
    const amount = amountKobo ? Number((amountKobo / 100).toFixed(2)) : undefined;

    const name = user.name ?? `${body.firstName ?? ""} ${body.lastName ?? ""}`.trim();
    const cleanName = name.trim();

    if (
      wallet.paystackDedicatedAccountId &&
      wallet.virtualAccountNumber &&
      wallet.virtualAccountBankName
    ) {
      const storedName = wallet.virtualAccountAccountName;
      const shouldOverride =
        storedName &&
        cleanName &&
        /\buser\b/i.test(storedName) &&
        !/\buser\b/i.test(cleanName);
      const displayName = shouldOverride ? cleanName : storedName ?? cleanName ?? user.phone;
      if (shouldOverride) {
        await prisma.wallet.update({
          where: { userId: wallet.userId },
          data: {
            virtualAccountAccountName: cleanName
          }
        });
      }
      return res.json({
        ok: true,
        wallet: {
          userId: wallet.userId,
          balanceKobo: wallet.balanceKobo,
          currency: wallet.currency
        },
        virtualAccount: {
          accountNumber: wallet.virtualAccountNumber,
          bankName: wallet.virtualAccountBankName,
          accountName: displayName,
          expiresAt: null,
          amount,
          amountKobo,
          currency: (body.currency ?? env.FLW_CURRENCY).toUpperCase(),
          providerTxRef: null,
          providerRef: wallet.paystackDedicatedAccountId ?? null
        }
      });
    }

    let customerCode = wallet.paystackCustomerCode;
    let customerId = wallet.paystackCustomerId;
    if (!customerCode) {
      const customer = await createPaystackCustomer({
        email: emailToUse,
        name: name || null,
        phone: user.phone,
        userId: user.id
      });
      customerCode = customer.customerCode;
      customerId = customer.customerId ?? customerId;
    }

    const result = await createDedicatedAccount({
      customerCode,
      preferredBank: env.PAYSTACK_DEDICATED_PROVIDER,
      phone: user.phone,
      accountName: name || null
    });

    const providerName = result.accountName?.trim();
    const shouldOverrideProvider =
      providerName &&
      cleanName &&
      /\buser\b/i.test(providerName) &&
      !/\buser\b/i.test(cleanName);
    const accountName =
      shouldOverrideProvider
        ? cleanName
        : providerName ?? cleanName ?? user.phone;

    const updatedWallet = await prisma.wallet.update({
      where: { userId: wallet.userId },
      data: {
        virtualAccountNumber: result.accountNumber,
        virtualAccountBankName: result.bankName,
        virtualAccountAccountName: accountName,
        paystackCustomerId: customerId ?? wallet.paystackCustomerId,
        paystackCustomerCode: customerCode ?? wallet.paystackCustomerCode,
        paystackDedicatedAccountId: result.dedicatedAccountId ?? wallet.paystackDedicatedAccountId
      }
    });

    res.json({
      ok: true,
      wallet: {
        userId: updatedWallet.userId,
        balanceKobo: updatedWallet.balanceKobo,
        currency: updatedWallet.currency
      },
      virtualAccount: {
        accountNumber: result.accountNumber,
        bankName: result.bankName,
        accountName: accountName,
        expiresAt: null,
        amount,
        amountKobo,
        currency: (body.currency ?? env.FLW_CURRENCY).toUpperCase(),
        providerTxRef: null,
        providerRef: result.dedicatedAccountId ?? null
      }
    });
  })
);

router.post(
  "/fund/initialize",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const body = z
      .object({
        email: z.string().email().optional(),
        name: z.string().min(1).max(100).optional(),
        currency: z.string().min(3).max(3).optional(),
        amount: z.coerce.number().positive().optional(),
        amountKobo: z.coerce.number().int().positive().optional()
      })
      .refine((data) => data.amount !== undefined || data.amountKobo !== undefined, {
        message: "amount or amountKobo is required"
      })
      .parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.auth!.userId }
    });

    if (!user) {
      throw notFound("User not found");
    }

    const amountKobo = body.amountKobo ?? Math.round((body.amount ?? 0) * 100);
    if (!amountKobo || amountKobo <= 0) {
      throw new AppError(400, "Amount must be greater than zero", "AMOUNT_REQUIRED");
    }
    const amount = Number((amountKobo / 100).toFixed(2));

    const email = body.email ?? `${user.id}@kobpay.local`;
    const name = body.name ?? user.name ?? "KOBPAY User";
    const currency = (body.currency ?? env.FLW_CURRENCY).toUpperCase();

    const redirectUrl =
      env.FLW_PAYMENT_REDIRECT_URL?.trim() ||
      `${env.API_BASE_URL.replace(/\/$/, "")}/api/wallet/fund/return`;

    const payment = await createPaymentLink({
      userId: user.id,
      phone: user.phone,
      name,
      email,
      currency,
      amount,
      redirectUrl
    });

    res.json({
      ok: true,
      payment: {
        link: payment.link,
        txRef: payment.txRef,
        amount,
        amountKobo,
        currency
      }
    });
  })
);

router.get("/fund/return", (_req, res) => {
  res.status(200).send("Payment received. You can close this page.");
});

router.post(
  "/fund/verify",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const body = z
      .object({
        txRef: z.string().min(6),
        amount: z.coerce.number().positive().optional(),
        amountKobo: z.coerce.number().int().positive().optional(),
        currency: z.string().min(3).max(3).optional()
      })
      .parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.auth!.userId }
    });
    if (!user) {
      throw notFound("User not found");
    }

    const verification = await verifyTransactionByReference(body.txRef);
    const status = String(verification.status ?? "").toLowerCase();
    if (!["successful", "success", "completed"].includes(status)) {
      return res.json({
        ok: true,
        status,
        verified: false,
        message: "Payment not successful yet"
      });
    }

    const refUserId = extractUserIdFromTxRef(String(verification.tx_ref ?? body.txRef));
    const meta = verification.meta ?? verification.meta_data;
    const metaUserId =
      meta && typeof meta === "object" && "userId" in meta ? String((meta as any).userId) : null;

    if (!refUserId && !metaUserId) {
      throw new AppError(400, "Unable to match payment to user", "PAYMENT_USER_UNKNOWN");
    }

    if (refUserId && refUserId !== user.id) {
      throw new AppError(403, "Payment does not belong to this user", "PAYMENT_FORBIDDEN");
    }
    if (!refUserId && metaUserId && metaUserId !== user.id) {
      throw new AppError(403, "Payment does not belong to this user", "PAYMENT_FORBIDDEN");
    }

    const amountKobo = toKobo(verification.amount ?? verification.charged_amount ?? 0);
    if (!amountKobo) {
      throw new AppError(400, "Payment amount missing", "PAYMENT_AMOUNT_MISSING");
    }

    const expectedKobo = body.amountKobo ?? toKobo(body.amount ?? 0);
    if (expectedKobo && amountKobo < expectedKobo) {
      throw new AppError(400, "Payment amount mismatch", "PAYMENT_AMOUNT_MISMATCH");
    }

    const currency = String(verification.currency ?? env.FLW_CURRENCY ?? "NGN").toUpperCase();
    if (body.currency && currency !== body.currency.toUpperCase()) {
      throw new AppError(400, "Payment currency mismatch", "PAYMENT_CURRENCY_MISMATCH");
    }

    const providerRef = String(
      verification.id ??
        verification.flw_ref ??
        verification.reference ??
        verification.tx_ref ??
        body.txRef
    );

    try {
      await prisma.$transaction(async (tx) => {
        await tx.wallet.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            balanceKobo: amountKobo,
            currency
          },
          update: {
            balanceKobo: { increment: amountKobo },
            currency
          }
        });

        await tx.transaction.create({
          data: {
            userId: user.id,
            type: "credit",
            category: "wallet_funding",
            amountKobo,
            feeKobo: toKobo(verification.app_fee ?? verification.fee ?? 0),
            totalKobo: amountKobo + toKobo(verification.app_fee ?? verification.fee ?? 0),
            provider: "flutterwave",
            providerRef,
            status: "successful",
            metaJson: verification
          }
        });
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return res.json({
          ok: true,
          status: "successful",
          verified: true,
          alreadyCredited: true
        });
      }
      throw err;
    }

    return res.json({
      ok: true,
      status: "successful",
      verified: true
    });
  })
);

export default router;
