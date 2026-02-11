import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../errors";
import { env } from "../config/env";
import { listBanks, resolveBankAccount } from "../services/flutterwaveTransfersService";

const router = Router();

const ensureAuth = (userId?: string) => {
  if (!userId) {
    throw new AppError(401, "Missing auth context", "AUTH_CONTEXT_MISSING");
  }
};

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = z
      .object({
        country: z.string().length(2).optional()
      })
      .parse(req.query);

    const banks = await listBanks((query.country ?? env.FLW_COUNTRY).toUpperCase());
    res.json({ ok: true, banks });
  })
);

router.get(
  "/accounts",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);
    const accounts = await prisma.bankAccount.findMany({
      where: { userId: req.auth!.userId },
      orderBy: { createdAt: "desc" }
    });
    res.json({ ok: true, accounts });
  })
);

router.post(
  "/resolve",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);
    const body = z
      .object({
        bankCode: z.string().min(2),
        accountNumber: z.string().min(6),
        save: z.coerce.boolean().optional()
      })
      .parse(req.body);

    const data = await resolveBankAccount(body.accountNumber, body.bankCode);
    const accountName = data?.account_name ?? data?.accountName ?? "";

    if (body.save) {
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
          bankName: data?.bank_name ?? data?.name ?? "",
          accountNumber: body.accountNumber,
          accountNameResolved: accountName || null
        }
      });
    }

    res.json({
      ok: true,
      account: {
        accountNumber: body.accountNumber,
        bankCode: body.bankCode,
        accountName
      }
    });
  })
);

export default router;
