import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError, notFound } from "../errors.js";
import {
  type BeneficiaryCategory,
  buildBeneficiaryKey,
  buildBeneficiaryLabelSuggestion,
  normalizePayload
} from "../utils/beneficiaries.js";

const router = Router();

const ensureAuth = (userId?: string) => {
  if (!userId) {
    throw new AppError(401, "Missing auth context", "AUTH_CONTEXT_MISSING");
  }
};

const categorySchema = z.enum(["airtime", "data", "cable", "electricity"]);

const airtimePayloadSchema = z.object({
  network: z.enum(["mtn", "airtel", "glo", "9mobile"]),
  phone: z.string().min(8)
});

const cablePayloadSchema = z.object({
  provider: z.enum(["gotv", "dstv", "startimes"]),
  smartNo: z.string().min(6),
  planVariation: z.string().min(2).optional()
});

const electricPayloadSchema = z.object({
  serviceCode: z.string().min(3),
  meterNo: z.string().min(6),
  meterType: z.enum(["prepaid", "postpaid"])
});

const parsePayload = (category: BeneficiaryCategory, payload: unknown) => {
  switch (category) {
    case "airtime":
    case "data":
      return airtimePayloadSchema.parse(payload);
    case "cable":
      return cablePayloadSchema.parse(payload);
    case "electricity":
      return electricPayloadSchema.parse(payload);
    default:
      throw new AppError(400, "Invalid beneficiary category", "INVALID_CATEGORY");
  }
};

router.get(
  "/",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const query = z
      .object({
        category: categorySchema.optional()
      })
      .parse(req.query);

    const where = {
      userId: req.auth!.userId,
      isActive: true,
      ...(query.category ? { category: query.category } : {})
    };

    const beneficiaries = await prisma.beneficiary.findMany({
      where,
      orderBy: {
        createdAt: "desc"
      }
    });

    res.json({
      ok: true,
      beneficiaries
    });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const body = z
      .object({
        category: categorySchema,
        label: z.string().max(60).optional(),
        payload: z.record(z.any())
      })
      .parse(req.body);

    const payload = parsePayload(body.category, body.payload);
    const normalized = normalizePayload(body.category, payload as any) as any;
    const dedupeKey = buildBeneficiaryKey(body.category, normalized);

    const existing = await prisma.beneficiary.findFirst({
      where: {
        userId: req.auth!.userId,
        category: body.category,
        dedupeKey
      }
    });

    const label =
      body.label && body.label.trim()
        ? body.label.trim()
        : buildBeneficiaryLabelSuggestion(body.category, normalized);

    if (existing) {
      const updated = await prisma.beneficiary.update({
        where: { id: existing.id },
        data: {
          label,
          isActive: true,
          lastUsedAt: new Date(),
          ...(normalized.network ? { network: normalized.network } : {}),
          ...(normalized.phone ? { phone: normalized.phone } : {}),
          ...(normalized.provider ? { provider: normalized.provider } : {}),
          ...(normalized.smartNo ? { smartNo: normalized.smartNo } : {}),
          ...(normalized.planVariation ? { planVariation: normalized.planVariation } : {}),
          ...(normalized.serviceCode ? { serviceCode: normalized.serviceCode } : {}),
          ...(normalized.meterNo ? { meterNo: normalized.meterNo } : {}),
          ...(normalized.meterType ? { meterType: normalized.meterType } : {})
        }
      });

      return res.json({
        ok: true,
        alreadyExists: true,
        beneficiary: updated
      });
    }

    const beneficiary = await prisma.beneficiary.create({
      data: {
        userId: req.auth!.userId,
        category: body.category,
        label,
        dedupeKey,
        lastUsedAt: new Date(),
        network: normalized.network ?? null,
        phone: normalized.phone ?? null,
        provider: normalized.provider ?? null,
        smartNo: normalized.smartNo ?? null,
        planVariation: normalized.planVariation ?? null,
        serviceCode: normalized.serviceCode ?? null,
        meterNo: normalized.meterNo ?? null,
        meterType: normalized.meterType ?? null
      }
    });

    res.json({
      ok: true,
      alreadyExists: false,
      beneficiary
    });
  })
);

router.post(
  "/:id/use",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const id = z.string().min(6).parse(req.params.id);
    const existing = await prisma.beneficiary.findFirst({
      where: { id, userId: req.auth!.userId }
    });
    if (!existing) {
      throw notFound("Beneficiary not found");
    }

    const updated = await prisma.beneficiary.update({
      where: { id },
      data: {
        lastUsedAt: new Date(),
        isActive: true
      }
    });

    res.json({
      ok: true,
      beneficiary: updated
    });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    ensureAuth(req.auth?.userId);

    const id = z.string().min(6).parse(req.params.id);
    const existing = await prisma.beneficiary.findFirst({
      where: { id, userId: req.auth!.userId }
    });
    if (!existing) {
      throw notFound("Beneficiary not found");
    }

    await prisma.beneficiary.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date()
      }
    });

    res.json({ ok: true });
  })
);

export default router;

