import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError, notFound } from "../errors";
import { sendSupportContactEmail } from "../services/emailService";

const router = Router();

const ensureAuth = (userId?: string) => {
  if (!userId) {
    throw new AppError(401, "Missing auth context", "AUTH_CONTEXT_MISSING");
  }
};

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const supportLimiter = new Map<string, number[]>();

const checkRateLimit = (key: string) => {
  const now = Date.now();
  const timestamps = supportLimiter.get(key) ?? [];
  const recent = timestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    throw new AppError(429, "Too many support requests. Try again later.", "SUPPORT_RATE_LIMIT");
  }
  recent.push(now);
  supportLimiter.set(key, recent);
};

router.post(
  "/contact",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const body = z
      .object({
        name: z.string().min(2).max(80),
        phone: z.string().min(8).max(20),
        subject: z.string().min(3).max(120),
        message: z.string().min(10).max(2000),
        appVersion: z.string().max(40).optional()
      })
      .parse(req.body);

    checkRateLimit(req.auth!.userId);

    const user = await prisma.user.findUnique({
      where: { id: req.auth!.userId }
    });

    if (!user) {
      throw notFound("User not found");
    }

    const normalizedPhone = body.phone.trim();
    const accountPhone = user.phone.trim();
    if (normalizedPhone !== accountPhone) {
      throw new AppError(400, "Phone must match your account phone", "PHONE_MISMATCH");
    }

    await sendSupportContactEmail({
      user: {
        id: user.id,
        phone: user.phone,
        createdAt: user.createdAt
      },
      payload: {
        name: body.name.trim(),
        phone: normalizedPhone,
        subject: body.subject.trim(),
        message: body.message.trim(),
        appVersion: body.appVersion ?? null
      }
    });

    res.json({ ok: true });
  })
);

export default router;
