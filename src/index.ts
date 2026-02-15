import path from "path";
import express, { type Request } from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import crypto from "crypto";
import { openapiSpec } from "./openapi.js";
import { env } from "./config/env.js";
import authRoutes from "./routes/auth.js";
import meRoutes from "./routes/me.js";
import walletRoutes from "./routes/wallet.js";
import webhookRoutes from "./routes/webhooks.js";
import billerRoutes from "./routes/billers.js";
import billRoutes from "./routes/bills.js";
import transactionRoutes from "./routes/transactions.js";
import giftcardRoutes from "./routes/giftcards.js";
import bankRoutes from "./routes/banks.js";
import withdrawalRoutes from "./routes/withdrawals.js";
import beneficiaryRoutes from "./routes/beneficiaries.js";
import accountRoutes from "./routes/account.js";
import securityRoutes from "./routes/security.js";
import exchangeRoutes from "./routes/exchange.js";
import adminExchangeRoutes from "./routes/admin/exchangeTrades.js";
import adminBannerRoutes from "./routes/admin/banners.js";
import adminBannerUiRoutes from "./routes/admin/bannerUi.js";
import supportRoutes from "./routes/support.js";
import bannerRoutes from "./routes/banners.js";
import { authMiddleware } from "./middleware/auth.js";
import { errorHandler } from "./middleware/error.js";
import { logWarn, logInfo } from "./utils/logger.js";

const app = express();

const corsOrigin = env.CORS_ORIGIN === "*"
  ? true
  : env.CORS_ORIGIN.split(",").map((o) => o.trim());

app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(
  "/uploads/banners",
  express.static(path.join(process.cwd(), "uploads", "banners"))
);
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as Request).rawBody = buf;
    }
  })
);

app.use((req, res, next) => {
  const requestId = crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
});

const warnIfMissing = (name: string, value?: string) => {
  if (!value || !value.trim()) {
    logWarn("env_missing", { name });
  }
};

const warnIfBadSecret = (name: string, value?: string) => {
  if (!value || !value.trim()) return;
  const trimmed = value.trim();
  if (!/^FLWSECK_(TEST|LIVE)_/i.test(trimmed)) {
    logWarn("env_unexpected_format", { name, prefix: value.slice(0, 12) });
  }
  const lowered = trimmed.toLowerCase();
  if (lowered.includes("xxxx") || lowered.includes("change")) {
    logWarn("env_placeholder_value", { name });
  }
};

const warnIfBadPaystackSecret = (name: string, value?: string) => {
  if (!value || !value.trim()) return;
  const trimmed = value.trim();
  if (!/^sk_(test|live)_/i.test(trimmed)) {
    logWarn("env_unexpected_format", { name, prefix: value.slice(0, 12) });
  }
  const lowered = trimmed.toLowerCase();
  if (lowered.includes("xxxx") || lowered.includes("change")) {
    logWarn("env_placeholder_value", { name });
  }
};

const checkEnv = () => {
  warnIfMissing("FLW_SECRET_KEY", env.FLW_SECRET_KEY);
  warnIfBadSecret("FLW_SECRET_KEY", env.FLW_SECRET_KEY);
  if (env.FLW_BASE_URL !== "https://api.flutterwave.com") {
    logWarn("env_unexpected_value", {
      name: "FLW_BASE_URL",
      value: env.FLW_BASE_URL
    });
  }
  warnIfMissing("VTU_API_KEY", env.VTU_API_KEY);
  const expectedVtuBase =
    env.VTU_MODE === "live"
      ? "https://vtuafrica.com.ng/portal/api"
      : "https://vtuafrica.com.ng/portal/api-test";
  if (env.VTU_BASE_URL !== expectedVtuBase) {
    logWarn("env_unexpected_value", {
      name: "VTU_BASE_URL",
      value: env.VTU_BASE_URL
    });
  }
  if (env.VTU_VERIFY_URL !== "https://vtuafrica.com.ng/portal/api/merchant-verify/") {
    logWarn("env_unexpected_value", {
      name: "VTU_VERIFY_URL",
      value: env.VTU_VERIFY_URL
    });
  }
  warnIfMissing("PAYSTACK_SECRET_KEY", env.PAYSTACK_SECRET_KEY);
  warnIfBadPaystackSecret("PAYSTACK_SECRET_KEY", env.PAYSTACK_SECRET_KEY);
  if (env.PAYSTACK_BASE_URL !== "https://api.paystack.co") {
    logWarn("env_unexpected_value", {
      name: "PAYSTACK_BASE_URL",
      value: env.PAYSTACK_BASE_URL
    });
  }
};

checkEnv();

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "kobpay", timestamp: new Date().toISOString() });
});

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));
app.use("/api/auth", authRoutes);
app.use("/api/me", authMiddleware, meRoutes);
app.use("/api/wallet", authMiddleware, walletRoutes);
app.use("/api/billers", authMiddleware, billerRoutes);
app.use("/api/bills", authMiddleware, billRoutes);
app.use("/api/transactions", authMiddleware, transactionRoutes);
app.use("/api/giftcards", authMiddleware, giftcardRoutes);
app.use("/api/banks", authMiddleware, bankRoutes);
app.use("/api/withdrawals", authMiddleware, withdrawalRoutes);
app.use("/api/beneficiaries", authMiddleware, beneficiaryRoutes);
app.use("/api/account", authMiddleware, accountRoutes);
app.use("/api/security", authMiddleware, securityRoutes);
app.use("/api/exchange", authMiddleware, exchangeRoutes);
app.use("/api/support", authMiddleware, supportRoutes);
app.use("/api/admin/exchange/trades", adminExchangeRoutes);
app.use("/api/admin/banners", adminBannerRoutes);
app.use("/admin/banners", adminBannerUiRoutes);
app.use("/api/banners", bannerRoutes);
app.use("/api/webhooks", webhookRoutes);

app.get("/", (_req, res) => {
  res.status(200).json({ ok: true, service: "KOBPAY API" });
});

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.use((_req, res) => {
  res.status(404).json({ ok: false, error: { message: "Not found", code: "NOT_FOUND" } });
});

app.use(errorHandler);

app.listen(env.PORT, "0.0.0.0", () => {
  logInfo("server_started", { url: env.API_BASE_URL, port: env.PORT });
  console.log(`KOBPAY API running on ${env.API_BASE_URL}`);
});

