import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import { prisma } from "../../db.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { AppError, notFound } from "../../errors.js";
import { env } from "../../config/env.js";

const router = Router();

const BANNERS_DIR = path.join(process.cwd(), "uploads", "banners");
const MAX_BANNER_BYTES = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BANNER_BYTES },
  fileFilter: (_req, file, cb) => {
    const allowedMime = new Set([
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp"
    ]);
    const ext = path.extname(file.originalname || "").toLowerCase();
    const allowedExt = new Set([".jpg", ".jpeg", ".png", ".webp"]);
    if (allowedMime.has(file.mimetype) || allowedExt.has(ext)) {
      cb(null, true);
      return;
    }
    cb(new AppError(400, "Only JPG, PNG, or WEBP files are allowed", "BANNER_INVALID"));
  }
});

const ensureAdmin = (req: any) => {
  const key = req.headers["x-admin-key"];
  if (!env.ADMIN_API_KEY || typeof key !== "string" || key !== env.ADMIN_API_KEY) {
    throw new AppError(401, "Invalid admin key", "ADMIN_KEY_INVALID");
  }
};

const ensureBannerDir = async () => {
  await fs.mkdir(BANNERS_DIR, { recursive: true });
};

const buildImagePath = (fileName: string) => `/uploads/banners/${fileName}`;

const buildPublicUrl = (pathValue: string) => {
  if (!pathValue) return pathValue;
  if (/^https?:\/\//i.test(pathValue)) return pathValue;
  const base = env.API_BASE_URL.replace(/\/$/, "");
  if (pathValue.startsWith("/")) {
    return `${base}${pathValue}`;
  }
  return `${base}/${pathValue}`;
};

const serializeBanner = (banner: any) => ({
  id: banner.id,
  title: banner.title,
  subtitle: banner.subtitle,
  imageUrl: buildPublicUrl(banner.imagePath),
  linkUrl: banner.linkUrl,
  sortOrder: banner.sortOrder,
  startAt: banner.startAt,
  endAt: banner.endAt,
  isActive: banner.isActive,
  createdAt: banner.createdAt,
  updatedAt: banner.updatedAt
});

const parseOptionalDate = (value?: string) => {
  if (!value || !value.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(400, "Invalid date value", "BANNER_DATE_INVALID");
  }
  return parsed;
};

const parseOptionalBool = (value: unknown) => {
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  throw new AppError(400, "Invalid boolean value", "BANNER_BOOL_INVALID");
};

const parseOptionalInt = (value: unknown) => {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new AppError(400, "Invalid number value", "BANNER_NUMBER_INVALID");
  }
  return parsed;
};

const parseOptionalUrl = (value?: string) => {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    new URL(trimmed);
  } catch (_) {
    throw new AppError(400, "Invalid URL value", "BANNER_URL_INVALID");
  }
  return trimmed;
};

const cleanString = (value?: string) => {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

router.get(
  "/",
  asyncHandler(async (req, res) => {
    ensureAdmin(req);

    const banners = await prisma.banner.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }]
    });

    res.json({
      ok: true,
      banners: banners.map(serializeBanner)
    });
  })
);

router.post(
  "/",
  upload.single("image"),
  asyncHandler(async (req, res) => {
    ensureAdmin(req);

    if (!req.file) {
      throw new AppError(400, "Banner image is required", "BANNER_IMAGE_REQUIRED");
    }

    const body = z
      .object({
        title: z.string().max(120).optional(),
        subtitle: z.string().max(200).optional(),
        linkUrl: z.string().optional(),
        isActive: z.any().optional(),
        sortOrder: z.any().optional(),
        startAt: z.string().optional(),
        endAt: z.string().optional()
      })
      .parse(req.body);

    await ensureBannerDir();

    const ext =
      path.extname(req.file.originalname || "").toLowerCase() ||
      (req.file.mimetype === "image/png"
        ? ".png"
        : req.file.mimetype === "image/webp"
          ? ".webp"
          : ".jpg");
    const fileName = `banner_${Date.now()}_${crypto.randomUUID()}${ext}`;
    const filePath = path.join(BANNERS_DIR, fileName);
    await fs.writeFile(filePath, req.file.buffer);

    const imagePath = buildImagePath(fileName);

    const banner = await prisma.banner.create({
      data: {
        title: cleanString(body.title) ?? null,
        subtitle: cleanString(body.subtitle) ?? null,
        linkUrl: parseOptionalUrl(body.linkUrl ?? "") ?? null,
        imagePath,
        isActive: parseOptionalBool(body.isActive) ?? true,
        sortOrder: parseOptionalInt(body.sortOrder) ?? 0,
        startAt: parseOptionalDate(body.startAt),
        endAt: parseOptionalDate(body.endAt)
      }
    });

    res.json({ ok: true, banner: serializeBanner(banner) });
  })
);

router.patch(
  "/:id",
  upload.single("image"),
  asyncHandler(async (req, res) => {
    ensureAdmin(req);

    const banner = await prisma.banner.findUnique({
      where: { id: req.params.id }
    });
    if (!banner) {
      throw notFound("Banner not found");
    }

    const body = z
      .object({
        title: z.string().max(120).optional(),
        subtitle: z.string().max(200).optional(),
        linkUrl: z.string().optional(),
        isActive: z.any().optional(),
        sortOrder: z.any().optional(),
        startAt: z.string().optional(),
        endAt: z.string().optional()
      })
      .parse(req.body);

    const hasField = (key: string) =>
      Object.prototype.hasOwnProperty.call(req.body, key);

    const data: Record<string, unknown> = {};
    if (hasField("title")) data.title = cleanString(body.title) ?? null;
    if (hasField("subtitle")) data.subtitle = cleanString(body.subtitle) ?? null;
    if (hasField("linkUrl")) data.linkUrl = parseOptionalUrl(body.linkUrl ?? "") ?? null;
    if (hasField("isActive")) data.isActive = parseOptionalBool(body.isActive);
    if (hasField("sortOrder")) data.sortOrder = parseOptionalInt(body.sortOrder);
    if (hasField("startAt")) data.startAt = parseOptionalDate(body.startAt);
    if (hasField("endAt")) data.endAt = parseOptionalDate(body.endAt);

    if (req.file) {
      await ensureBannerDir();
      const ext =
        path.extname(req.file.originalname || "").toLowerCase() ||
        (req.file.mimetype === "image/png"
          ? ".png"
          : req.file.mimetype === "image/webp"
            ? ".webp"
            : ".jpg");
      const fileName = `banner_${Date.now()}_${crypto.randomUUID()}${ext}`;
      const filePath = path.join(BANNERS_DIR, fileName);
      await fs.writeFile(filePath, req.file.buffer);

      const imagePath = buildImagePath(fileName);
      data.imagePath = imagePath;

      if (banner.imagePath.startsWith("/uploads/banners/")) {
        const oldFile = path.join(BANNERS_DIR, path.basename(banner.imagePath));
        await fs.unlink(oldFile).catch(() => undefined);
      }
    }

    const updated = await prisma.banner.update({
      where: { id: banner.id },
      data
    });

    res.json({ ok: true, banner: serializeBanner(updated) });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    ensureAdmin(req);

    const banner = await prisma.banner.findUnique({
      where: { id: req.params.id }
    });
    if (!banner) {
      throw notFound("Banner not found");
    }

    await prisma.banner.delete({ where: { id: banner.id } });

    if (banner.imagePath.startsWith("/uploads/banners/")) {
      const filePath = path.join(BANNERS_DIR, path.basename(banner.imagePath));
      await fs.unlink(filePath).catch(() => undefined);
    }

    res.json({ ok: true });
  })
);

export default router;
