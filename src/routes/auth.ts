import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcrypt";
import { prisma } from "../db.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requestOtp, verifyOtp } from "../services/otpService.js";
import { issueTokens, verifyRefreshToken } from "../services/tokenService.js";
import { AppError, forbidden, notFound } from "../errors.js";

const router = Router();

const phoneSchema = z.string().min(7).max(20);
const passwordSchema = z
  .string()
  .min(8)
  .max(200)
  .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/);
const fullNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(100);

const normalizePhone = (phone: string) => phone.trim();

router.post(
  "/otp/request",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        phone: phoneSchema
      })
      .parse(req.body);

    const phone = normalizePhone(body.phone);
    const existing = await prisma.user.findUnique({
      where: { phone }
    });
    if (existing) {
      if (existing.status === "DELETED") {
        // Allow reactivation via OTP flow
      } else if (existing.status === "ACTIVE") {
        throw new AppError(409, "Account already exists. Please log in.", "USER_EXISTS");
      } else {
        throw forbidden("User not active");
      }
    }

    const result = await requestOtp(phone);

    res.json({
      ok: true,
      expiresAt: result.expiresAt,
      ...(result.code ? { devOtp: result.code } : {})
    });
  })
);

router.post(
  "/otp/verify",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        phone: phoneSchema,
        code: z.string().min(4).max(10),
        name: fullNameSchema,
        password: passwordSchema
      })
      .parse(req.body);

    const phone = normalizePhone(body.phone);
    const existing = await prisma.user.findUnique({
      where: { phone }
    });
    if (existing) {
      if (existing.status === "DELETED") {
        // Allow reactivation via OTP verification
      } else if (existing.status === "ACTIVE") {
        throw new AppError(409, "Account already exists. Please log in.", "USER_EXISTS");
      } else {
        throw forbidden("User not active");
      }
    }

    const isValid = verifyOtp(phone, body.code);
    if (!isValid) {
      throw new AppError(400, "Invalid or expired OTP", "OTP_INVALID");
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const name = body.name.trim();
    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            phone,
            name,
            status: "ACTIVE",
            deletedAt: null,
            security: {
              upsert: {
                create: { passwordHash },
                update: { passwordHash }
              }
            }
          }
        })
      : await prisma.user.create({
          data: {
            phone,
            name,
            security: {
              create: {
                passwordHash
              }
            }
          }
        });

    if (user.status !== "ACTIVE") {
      throw forbidden("User not active");
    }

    const tokens = issueTokens(user.id, user.phone);

    res.json({
      ok: true,
      ...tokens,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        status: user.status
      }
    });
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        phone: phoneSchema,
        password: passwordSchema
      })
      .parse(req.body);

    const phone = normalizePhone(body.phone);
    const user = await prisma.user.findUnique({
      where: { phone },
      include: { security: true }
    });

    if (!user?.security?.passwordHash) {
      throw new AppError(401, "Invalid phone or password", "AUTH_INVALID");
    }

    if (user.status !== "ACTIVE") {
      throw forbidden("User not active");
    }

    const matches = await bcrypt.compare(body.password, user.security.passwordHash);
    if (!matches) {
      throw new AppError(401, "Invalid phone or password", "AUTH_INVALID");
    }

    const tokens = issueTokens(user.id, user.phone);

    res.json({
      ok: true,
      ...tokens,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        status: user.status
      }
    });
  })
);

router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        refreshToken: z.string().min(10)
      })
      .parse(req.body);

    const payload = verifyRefreshToken(body.refreshToken);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub }
    });

    if (!user) {
      throw notFound("User not found");
    }

    if (user.status !== "ACTIVE") {
      throw forbidden("User not active");
    }

    const tokens = issueTokens(user.id, user.phone);

    res.json({
      ok: true,
      ...tokens
    });
  })
);

export default router;

