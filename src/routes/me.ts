import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcrypt";
import { prisma } from "../db.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError, notFound } from "../errors.js";

const router = Router();

const pinSchema = z
  .string()
  .regex(/^\d{4}$/)
  .describe("4-digit PIN");

const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCK_SECONDS = 900;

const ensureAuth = (userId?: string) => {
  if (!userId) {
    throw new AppError(401, "Missing auth context", "AUTH_CONTEXT_MISSING");
  }
};

const serializeUser = (user: {
  id: string;
  phone: string;
  email: string | null;
  name: string | null;
  status: any;
  createdAt: Date;
  profileImageUrl?: string | null;
}) => ({
  id: user.id,
  phone: user.phone,
  email: user.email,
  name: user.name,
  profileImageUrl: user.profileImageUrl ?? null,
  status: user.status,
  createdAt: user.createdAt
});

const MAX_PROFILE_IMAGE_BYTES = 2 * 1024 * 1024;

const parseImageDataUrl = (dataUrl: string) => {
  const trimmed = dataUrl.trim();
  const match = trimmed.match(/^data:(image\/(png|jpeg|jpg));base64,(.+)$/i);
  if (!match) {
    throw new AppError(
      400,
      "Only JPG or PNG images are allowed",
      "IMAGE_TYPE_INVALID"
    );
  }
  const base64 = match[3] ?? "";
  const bytes = Buffer.from(base64, "base64");
  if (!bytes.length) {
    throw new AppError(400, "Invalid image data", "IMAGE_DATA_INVALID");
  }
  if (bytes.length > MAX_PROFILE_IMAGE_BYTES) {
    throw new AppError(400, "Image must be 2MB or less", "IMAGE_TOO_LARGE");
  }
  return trimmed;
};

router.get(
  "/",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const user = await prisma.user.findUnique({
      where: { id: req.auth!.userId },
      include: { security: true }
    });

    if (!user) {
      throw notFound("User not found");
    }

    res.json({
      ok: true,
      user: {
        ...serializeUser(user),
        hasPin: Boolean(user.security?.pinHash),
        hasPassword: Boolean(user.security?.passwordHash),
        biometricsEnabled: Boolean(user.security?.biometricsEnabled)
      }
    });
  })
);

router.post(
  "/email",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const body = z
      .object({
        email: z.string().email()
      })
      .parse(req.body);

    const updated = await prisma.user.update({
      where: { id: req.auth!.userId },
      data: {
        email: body.email
      }
    });

    res.json({
      ok: true,
      user: serializeUser(updated)
    });
  })
);

router.post(
  "/photo",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const body = z
      .object({
        imageDataUrl: z.string().min(20)
      })
      .parse(req.body);

    const imageDataUrl = parseImageDataUrl(body.imageDataUrl);

    const updated = await prisma.user.update({
      where: { id: req.auth!.userId },
      data: {
        profileImageUrl: imageDataUrl
      }
    });

    res.json({
      ok: true,
      user: serializeUser(updated)
    });
  })
);

router.post(
  "/pin",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const body = z
      .object({
        pin: pinSchema
      })
      .parse(req.body);

    const security = await prisma.security.findUnique({
      where: { userId: req.auth!.userId }
    });

    if (security?.lockedUntil && security.lockedUntil.getTime() > Date.now()) {
      throw new AppError(423, "PIN is temporarily locked", "PIN_LOCKED");
    }

    if (security?.pinHash) {
      throw new AppError(409, "PIN already set", "PIN_ALREADY_SET");
    }

    const pinHash = await bcrypt.hash(body.pin, 10);

    if (security) {
      await prisma.security.update({
        where: { userId: req.auth!.userId },
        data: {
          pinHash,
          failedAttempts: 0,
          lockedUntil: null
        }
      });
    } else {
      await prisma.security.create({
        data: {
          userId: req.auth!.userId,
          pinHash
        }
      });
    }

    res.json({ ok: true });
  })
);

router.post(
  "/pin/change",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const body = z
      .object({
        currentPin: pinSchema,
        newPin: pinSchema
      })
      .parse(req.body);

    const security = await prisma.security.findUnique({
      where: { userId: req.auth!.userId }
    });

    if (!security?.pinHash) {
      throw new AppError(400, "PIN not set", "PIN_NOT_SET");
    }

    if (security.lockedUntil && security.lockedUntil.getTime() > Date.now()) {
      throw new AppError(423, "PIN is temporarily locked", "PIN_LOCKED");
    }

    const matches = await bcrypt.compare(body.currentPin, security.pinHash);
    if (!matches) {
      const nextAttempts = security.failedAttempts + 1;
      const shouldLock = nextAttempts >= PIN_MAX_ATTEMPTS;

      await prisma.security.update({
        where: { userId: req.auth!.userId },
        data: {
          failedAttempts: nextAttempts,
          lockedUntil: shouldLock
            ? new Date(Date.now() + PIN_LOCK_SECONDS * 1000)
            : null
        }
      });

      throw new AppError(401, "Invalid PIN", "PIN_INVALID");
    }

    const pinHash = await bcrypt.hash(body.newPin, 10);

    await prisma.security.update({
      where: { userId: req.auth!.userId },
      data: {
        pinHash,
        failedAttempts: 0,
        lockedUntil: null
      }
    });

    res.json({ ok: true });
  })
);

export default router;

