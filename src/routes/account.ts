import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcrypt";
import { prisma } from "../db";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError, notFound } from "../errors";

const router = Router();

const ensureAuth = (userId?: string) => {
  if (!userId) {
    throw new AppError(401, "Missing auth context", "AUTH_CONTEXT_MISSING");
  }
};

router.delete(
  "/",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const body = z
      .object({
        pin: z.string().regex(/^\d{4}$/)
      })
      .parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.auth!.userId }
    });
    if (!user) {
      throw notFound("User not found");
    }

    const security = await prisma.security.findUnique({
      where: { userId: user.id }
    });
    if (!security?.pinHash) {
      throw new AppError(400, "PIN is required", "PIN_REQUIRED");
    }
    const pinOk = await bcrypt.compare(body.pin, security.pinHash);
    if (!pinOk) {
      throw new AppError(401, "Invalid PIN", "PIN_INVALID");
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          status: "DELETED",
          deletedAt: new Date()
        }
      });

      await tx.beneficiary.updateMany({
        where: { userId: user.id },
        data: {
          isActive: false,
          deletedAt: new Date()
        }
      });
    });

    res.json({ ok: true });
  })
);

export default router;
