import fs from "fs/promises";
import path from "path";
import nodemailer from "nodemailer";
import { env } from "../config/env";
import { AppError } from "../errors";
import { logInfo, logWarn } from "../utils/logger";

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export const isSmtpConfigured = () =>
  Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);

const createTransport = () =>
  nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    }
  });

const formatAmount = (minor: number, currency: string) => {
  const major = (minor / 100).toFixed(2);
  return `${currency.toUpperCase()} ${major}`;
};

const maskAccount = (value?: string | null) => {
  if (!value) return "";
  const cleaned = value.replace(/\s+/g, "");
  if (cleaned.length <= 4) return cleaned;
  return `${"*".repeat(cleaned.length - 4)}${cleaned.slice(-4)}`;
};

const summarizeReceivingDetails = (details: any, currency: string) => {
  if (!details || typeof details !== "object") return "";
  if (currency.toUpperCase() === "NGN") {
    return [
      `Bank: ${details.bankName ?? ""}`,
      `Account Name: ${details.accountName ?? ""}`,
      `Account Number: ${maskAccount(details.accountNumber)}`
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    `Beneficiary: ${details.beneficiaryName ?? ""}`,
    `IBAN: ${maskAccount(details.iban)}`,
    `SWIFT/BIC: ${details.swiftBic ?? ""}`,
    `Bank: ${details.bankName ?? ""}`,
    details.bankAddress ? `Bank Address: ${details.bankAddress}` : null,
    details.beneficiaryAddress
      ? `Beneficiary Address: ${details.beneficiaryAddress}`
      : null
  ]
    .filter(Boolean)
    .join("\n");
};

export const sendExchangeReceiptEmail = async (input: {
  tradeId: string;
  fromCurrency: string;
  toCurrency: string;
  fromAmountMinor: number;
  toAmountMinor: number;
  rate: number;
  createdAt: Date;
  receivingDetails: unknown;
  receiptFileName?: string | null;
  receiptFileUrl?: string | null;
  receiptMimeType?: string | null;
  receiptsDir: string;
}) => {
  if (!isSmtpConfigured()) {
    logWarn("smtp_not_configured", { tradeId: input.tradeId });
    return;
  }

  const transporter = createTransport();
  const receiptLink = input.receiptFileUrl
    ? `${env.API_BASE_URL.replace(/\/$/, "")}${input.receiptFileUrl}`
    : null;

  const textLines = [
    `Trade ID: ${input.tradeId}`,
    `Pair: ${input.fromCurrency} -> ${input.toCurrency}`,
    `From Amount: ${formatAmount(input.fromAmountMinor, input.fromCurrency)}`,
    `To Amount: ${formatAmount(input.toAmountMinor, input.toCurrency)}`,
    `Rate: ${input.rate}`,
    `Created At: ${input.createdAt.toISOString()}`,
    "",
    "Receiving Details:",
    summarizeReceivingDetails(input.receivingDetails, input.toCurrency),
    "",
    receiptLink
      ? `Receipt: ${receiptLink} (requires admin key to download)`
      : "Receipt: not available"
  ];

  const mailOptions: nodemailer.SendMailOptions = {
    from: env.SMTP_FROM,
    to: env.ADMIN_RECEIPT_EMAIL,
    subject: `KOBPAY Exchange Payment Submitted - Trade ${input.tradeId}`,
    text: textLines.join("\n")
  };

  if (input.receiptFileName) {
    const filePath = path.join(input.receiptsDir, input.receiptFileName);
    try {
      const stat = await fs.stat(filePath);
      if (stat.size <= MAX_ATTACHMENT_BYTES) {
        mailOptions.attachments = [
          {
            filename: input.receiptFileName,
            path: filePath,
            contentType: input.receiptMimeType ?? undefined
          }
        ];
      }
    } catch (err) {
      logWarn("receipt_attachment_failed", { tradeId: input.tradeId });
    }
  }

  await transporter.sendMail(mailOptions);
  logInfo("exchange_receipt_email_sent", { tradeId: input.tradeId });
};

export const sendSupportContactEmail = async (input: {
  user: {
    id: string;
    phone: string;
    createdAt: Date;
  };
  payload: {
    name: string;
    phone: string;
    subject: string;
    message: string;
    appVersion?: string | null;
  };
}) => {
  if (!isSmtpConfigured()) {
    throw new AppError(503, "SMTP is not configured", "SMTP_NOT_CONFIGURED");
  }

  const transporter = createTransport();

  const text = [
    `Name: ${input.payload.name}`,
    `Phone: ${input.payload.phone}`,
    `User ID: ${input.user.id}`,
    `Account Phone: ${input.user.phone}`,
    `Created At: ${input.user.createdAt.toISOString()}`,
    `App Version: ${input.payload.appVersion ?? "unknown"}`,
    "",
    input.payload.message
  ].join("\n");

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: env.ADMIN_RECEIPT_EMAIL,
    subject: `KOBPAY Support: ${input.payload.subject} [${input.user.phone}]`,
    text
  });

  logInfo("support_contact_email_sent", { userId: input.user.id });
};
