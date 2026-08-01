import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";
import { AppError } from "../../errors.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  isSmsProvider,
  setActiveSmsProvider,
  smsProviders
} from "../../services/smsProviderSettings.js";
import { getSmsProviderStatus } from "../../services/smsService.js";

const router = Router();

const ensureAdmin = (req: any) => {
  const key = req.headers["x-admin-key"];
  if (!env.ADMIN_API_KEY || typeof key !== "string" || key !== env.ADMIN_API_KEY) {
    throw new AppError(401, "Invalid admin key", "ADMIN_KEY_INVALID");
  }
};

router.get(
  "/",
  asyncHandler(async (req, res) => {
    ensureAdmin(req);
    const status = await getSmsProviderStatus();
    res.json({
      ok: true,
      providerOptions: smsProviders,
      ...status
    });
  })
);

router.patch(
  "/",
  asyncHandler(async (req, res) => {
    ensureAdmin(req);

    const body = z
      .object({
        activeProvider: z.string().transform((value) => value.trim().toUpperCase())
      })
      .parse(req.body);

    if (!isSmsProvider(body.activeProvider)) {
      throw new AppError(400, "Invalid SMS provider", "SMS_PROVIDER_INVALID");
    }

    await setActiveSmsProvider(body.activeProvider);
    const status = await getSmsProviderStatus();
    res.json({
      ok: true,
      providerOptions: smsProviders,
      ...status
    });
  })
);

export default router;
