import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcrypt";
import { prisma } from "../db.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError, notFound } from "../errors.js";
import { requestOtp, verifyOtp } from "../services/otpService.js";

const router = Router();

const ensureAuth = (userId?: string) => {
  if (!userId) {
    throw new AppError(401, "Missing auth context", "AUTH_CONTEXT_MISSING");
  }
};

const pinSchema = z.string().regex(/^\d{4}$/);
const passwordSchema = z
  .string()
  .min(8)
  .max(200)
  .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/);

const getUserWithSecurity = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { security: true }
  });
  if (!user) {
    throw notFound("User not found");
  }
  return user;
};

router.get(
  "/settings",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const user = await getUserWithSecurity(req.auth!.userId);
    res.json({
      ok: true,
      settings: {
        hasPin: Boolean(user.security?.pinHash),
        hasPassword: Boolean(user.security?.passwordHash),
        biometricsEnabled: Boolean(user.security?.biometricsEnabled)
      }
    });
  })
);

router.post(
  "/pin/set",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const body = z
      .object({
        pin: pinSchema
      })
      .parse(req.body);

    const user = await getUserWithSecurity(req.auth!.userId);

    if (user.security?.pinHash) {
      throw new AppError(409, "PIN already set", "PIN_ALREADY_SET");
    }

    const pinHash = await bcrypt.hash(body.pin, 10);
    if (user.security) {
      await prisma.security.update({
        where: { userId: user.id },
        data: {
          pinHash,
          failedAttempts: 0,
          lockedUntil: null
        }
      });
    } else {
      await prisma.security.create({
        data: {
          userId: user.id,
          pinHash
        }
      });
    }

    res.json({ ok: true });
  })
);

router.post(
  "/pin/change/request-otp",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const user = await getUserWithSecurity(req.auth!.userId);
    const result = await requestOtp(user.phone);

    res.json({
      ok: true,
      expiresAt: result.expiresAt,
      ...(result.code ? { devOtp: result.code } : {})
    });
  })
);

router.post(
  "/pin/change/confirm",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const body = z
      .object({
        otpCode: z.string().min(4).max(10),
        newPin: pinSchema
      })
      .parse(req.body);

    const user = await getUserWithSecurity(req.auth!.userId);
    const ok = verifyOtp(user.phone, body.otpCode);
    if (!ok) {
      throw new AppError(400, "Invalid or expired OTP", "OTP_INVALID");
    }

    const pinHash = await bcrypt.hash(body.newPin, 10);
    if (user.security) {
      await prisma.security.update({
        where: { userId: user.id },
        data: {
          pinHash,
          failedAttempts: 0,
          lockedUntil: null,
          biometricsEnabled: false
        }
      });
    } else {
      await prisma.security.create({
        data: {
          userId: user.id,
          pinHash,
          biometricsEnabled: false
        }
      });
    }

    res.json({ ok: true });
  })
);

router.post(
  "/biometrics/enable",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const user = await getUserWithSecurity(req.auth!.userId);
    if (user.security) {
      await prisma.security.update({
        where: { userId: user.id },
        data: { biometricsEnabled: true }
      });
    } else {
      await prisma.security.create({
        data: {
          userId: user.id,
          biometricsEnabled: true
        }
      });
    }

    res.json({ ok: true });
  })
);

router.post(
  "/biometrics/disable",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const user = await getUserWithSecurity(req.auth!.userId);
    if (user.security) {
      await prisma.security.update({
        where: { userId: user.id },
        data: { biometricsEnabled: false }
      });
    } else {
      await prisma.security.create({
        data: {
          userId: user.id,
          biometricsEnabled: false
        }
      });
    }

    res.json({ ok: true });
  })
);

router.post(
  "/password/change/request-otp",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);
    const user = await getUserWithSecurity(req.auth!.userId);
    const result = await requestOtp(user.phone);

    res.json({
      ok: true,
      expiresAt: result.expiresAt,
      ...(result.code ? { devOtp: result.code } : {})
    });
  })
);

router.post(
  "/password/set",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const body = z
      .object({
        otpCode: z.string().min(4).max(10),
        newPassword: passwordSchema
      })
      .parse(req.body);

    const user = await getUserWithSecurity(req.auth!.userId);
    const ok = verifyOtp(user.phone, body.otpCode);
    if (!ok) {
      throw new AppError(400, "Invalid or expired OTP", "OTP_INVALID");
    }

    if (user.security?.passwordHash) {
      throw new AppError(409, "Password already set", "PASSWORD_ALREADY_SET");
    }

    const passwordHash = await bcrypt.hash(body.newPassword, 10);
    if (user.security) {
      await prisma.security.update({
        where: { userId: user.id },
        data: { passwordHash }
      });
    } else {
      await prisma.security.create({
        data: {
          userId: user.id,
          passwordHash
        }
      });
    }

    res.json({ ok: true });
  })
);

router.post(
  "/password/change",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const body = z
      .object({
        otpCode: z.string().min(4).max(10),
        currentPassword: z.string().min(6).max(200),
        newPassword: passwordSchema
      })
      .parse(req.body);

    const user = await getUserWithSecurity(req.auth!.userId);
    if (!user.security?.passwordHash) {
      throw new AppError(400, "Password not set", "PASSWORD_NOT_SET");
    }

    const ok = verifyOtp(user.phone, body.otpCode);
    if (!ok) {
      throw new AppError(400, "Invalid or expired OTP", "OTP_INVALID");
    }

    const matches = await bcrypt.compare(body.currentPassword, user.security.passwordHash);
    if (!matches) {
      throw new AppError(401, "Invalid password", "PASSWORD_INVALID");
    }

    const passwordHash = await bcrypt.hash(body.newPassword, 10);
    await prisma.security.update({
      where: { userId: user.id },
      data: { passwordHash }
    });

    res.json({ ok: true });
  })
);

export default router;

