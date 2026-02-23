import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { AppError, notFound } from "../../errors.js";
import { env } from "../../config/env.js";

const router = Router();

const ensureAdmin = (req: any) => {
  const key = req.headers["x-admin-key"];
  if (!env.ADMIN_API_KEY || typeof key !== "string" || key !== env.ADMIN_API_KEY) {
    throw new AppError(401, "Invalid admin key", "ADMIN_KEY_INVALID");
  }
};

const allowedStatuses = new Set(["ACTIVE", "SUSPENDED", "DISABLED", "DELETED"]);

const cleanString = (value?: string) => {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const ensureValidEmail = (email: string) => {
  const parsed = z.string().email().safeParse(email);
  if (!parsed.success) {
    throw new AppError(400, "Invalid email address", "INVALID_EMAIL");
  }
};

const ensureValidPhone = (phone: string) => {
  const trimmed = phone.trim();
  if (trimmed.length < 6) {
    throw new AppError(400, "Invalid phone number", "INVALID_PHONE");
  }
};

const serializeUser = (user: any) => ({
  id: user.id,
  phone: user.phone,
  email: user.email,
  name: user.name,
  status: user.status,
  profileImageUrl: user.profileImageUrl,
  createdAt: user.createdAt,
  deletedAt: user.deletedAt,
  walletBalanceKobo: user.wallet?.balanceKobo ?? null,
  walletCurrency: user.wallet?.currency ?? null,
  walletUpdatedAt: user.wallet?.updatedAt ?? null,
  transactionCount: user._count?.transactions ?? 0
});

const serializeTransaction = (tx: any) => ({
  id: tx.id,
  type: tx.type,
  category: tx.category,
  amountKobo: tx.amountKobo,
  feeKobo: tx.feeKobo,
  totalKobo: tx.totalKobo,
  provider: tx.provider,
  providerRef: tx.providerRef,
  status: tx.status,
  createdAt: tx.createdAt
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    ensureAdmin(req);

    const query = z
      .object({
        limit: z.coerce.number().int().min(1).max(100).optional(),
        cursor: z.string().uuid().optional(),
        status: z.string().optional(),
        q: z.string().optional()
      })
      .parse(req.query);

    const status = query.status?.trim().toUpperCase();
    if (status && !allowedStatuses.has(status)) {
      throw new AppError(400, "Invalid status filter", "USER_STATUS_INVALID");
    }

    const where: Record<string, any> = {};
    if (status) {
      where.status = status;
    }
    if (query.q?.trim()) {
      const search = query.q.trim();
      where.OR = [
        { phone: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { id: { contains: search, mode: "insensitive" } }
      ];
    }

    const limit = query.limit ?? 20;
    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      include: {
        wallet: {
          select: {
            balanceKobo: true,
            currency: true,
            updatedAt: true
          }
        },
        _count: { select: { transactions: true } }
      }
    });

    const nextCursor = users.length === limit ? users[users.length - 1]?.id : null;

    res.json({
      ok: true,
      users: users.map(serializeUser),
      nextCursor
    });
  })
);

router.get(
  "/:id/transactions",
  asyncHandler(async (req, res) => {
    ensureAdmin(req);

    const query = z
      .object({
        limit: z.coerce.number().int().min(1).max(100).optional(),
        cursor: z.string().uuid().optional()
      })
      .parse(req.query);

    const limit = query.limit ?? 20;
    const transactions = await prisma.transaction.findMany({
      where: { userId: req.params.id },
      orderBy: { createdAt: "desc" },
      take: limit,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {})
    });

    const nextCursor =
      transactions.length === limit ? transactions[transactions.length - 1]?.id : null;

    res.json({
      ok: true,
      transactions: transactions.map(serializeTransaction),
      nextCursor
    });
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    ensureAdmin(req);

    const user = await prisma.user.findUnique({
      where: { id: req.params.id }
    });
    if (!user) {
      throw notFound("User not found");
    }

    const body = z
      .object({
        name: z.string().max(120).optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        status: z.enum(["ACTIVE", "SUSPENDED", "DISABLED", "DELETED"]).optional()
      })
      .parse(req.body);

    const hasField = (key: string) =>
      Object.prototype.hasOwnProperty.call(req.body, key);

    const data: Record<string, unknown> = {};

    if (hasField("name")) {
      data.name = cleanString(body.name);
    }

    if (hasField("email")) {
      const normalized = cleanString(body.email);
      if (normalized) {
        ensureValidEmail(normalized);
      }
      data.email = normalized;
    }

    if (hasField("phone")) {
      const normalized = cleanString(body.phone);
      if (!normalized) {
        throw new AppError(400, "Phone is required", "USER_PHONE_REQUIRED");
      }
      ensureValidPhone(normalized);
      data.phone = normalized;
    }

    if (body.status) {
      data.status = body.status;
      if (body.status === "DELETED") {
        data.deletedAt = user.deletedAt ?? new Date();
      } else {
        data.deletedAt = null;
      }
    }

    let updated = user;
    const shouldDeactivate =
      body.status === "DELETED" && user.status !== "DELETED";

    try {
      if (shouldDeactivate) {
        await prisma.$transaction(async (tx) => {
          updated = await tx.user.update({
            where: { id: user.id },
            data
          });

          await tx.beneficiary.updateMany({
            where: { userId: user.id },
            data: {
              isActive: false,
              deletedAt: new Date()
            }
          });
        });
      } else {
        updated = await prisma.user.update({
          where: { id: user.id },
          data
        });
      }
    } catch (err) {
      if (typeof err === "object" && err !== null && "code" in err) {
        const code = (err as { code?: string }).code;
        if (code === "P2002") {
          throw new AppError(400, "Duplicate value for unique field", "DUPLICATE_VALUE");
        }
      }
      throw err;
    }

    res.json({ ok: true, user: serializeUser(updated) });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    ensureAdmin(req);

    const user = await prisma.user.findUnique({
      where: { id: req.params.id }
    });
    if (!user) {
      throw notFound("User not found");
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          status: "DELETED",
          deletedAt: now
        }
      });

      await tx.beneficiary.updateMany({
        where: { userId: user.id },
        data: {
          isActive: false,
          deletedAt: now
        }
      });
    });

    res.json({ ok: true });
  })
);

export default router;
