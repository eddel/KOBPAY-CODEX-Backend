import { Router } from "express";
import { prisma } from "../db.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { env } from "../config/env.js";

const router = Router();

const buildPublicUrl = (path: string) => {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  const base = env.API_BASE_URL.replace(/\/$/, "");
  if (path.startsWith("/")) {
    return `${base}${path}`;
  }
  return `${base}/${path}`;
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

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const banners = await prisma.banner.findMany({
      where: {
        isActive: true,
        AND: [
          {
            OR: [{ startAt: null }, { startAt: { lte: now } }]
          },
          {
            OR: [{ endAt: null }, { endAt: { gt: now } }]
          }
        ]
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }]
    });

    res.json({
      ok: true,
      banners: banners.map(serializeBanner)
    });
  })
);

export default router;
