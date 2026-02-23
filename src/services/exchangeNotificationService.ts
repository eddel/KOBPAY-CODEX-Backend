import { env } from "../config/env.js";
import { logWarn } from "../utils/logger.js";
import { sendExchangeAdminNotification } from "./emailService.js";
import { sendSmsMessage } from "./smsService.js";

export type ExchangeAction =
  | "trade_created"
  | "payment_submitted"
  | "trade_cancelled"
  | "payment_received"
  | "trade_completed";

const actionLabels: Record<ExchangeAction, string> = {
  trade_created: "Trade Created",
  payment_submitted: "Payment Submitted",
  trade_cancelled: "Trade Cancelled",
  payment_received: "Payment Received",
  trade_completed: "Trade Completed"
};

const smsMessages: Record<ExchangeAction, string> = {
  trade_created: "New exchange started successfully.",
  payment_submitted: "Your exchange payment was submitted successfully.",
  trade_cancelled: "Your exchange has been cancelled.",
  payment_received: "Your exchange payment has been confirmed.",
  trade_completed: "Your exchange has been completed."
};

const buildAdminLink = () =>
  `${env.API_BASE_URL.replace(/\/+$/, "")}/admin/banners`;

const resolveEventTime = (action: ExchangeAction, trade: {
  createdAt: Date;
  paidAt?: Date | null;
  paymentReceivedAt?: Date | null;
  completedAt?: Date | null;
  cancelledAt?: Date | null;
}) => {
  switch (action) {
    case "payment_submitted":
      return trade.paidAt ?? new Date();
    case "payment_received":
      return trade.paymentReceivedAt ?? new Date();
    case "trade_completed":
      return trade.completedAt ?? new Date();
    case "trade_cancelled":
      return trade.cancelledAt ?? new Date();
    case "trade_created":
    default:
      return trade.createdAt ?? new Date();
  }
};

export const notifyExchangeAction = async (input: {
  action: ExchangeAction;
  trade: {
    id: string;
    userId: string;
    fromCurrency: string;
    toCurrency: string;
    fromAmountMinor: number;
    toAmountMinor: number;
    rate: number;
    rateSource?: string | null;
    status: string;
    createdAt: Date;
    paidAt?: Date | null;
    paymentReceivedAt?: Date | null;
    completedAt?: Date | null;
    cancelledAt?: Date | null;
  };
  userPhone?: string | null;
  notifyAdmin?: boolean;
  notifyUser?: boolean;
}) => {
  const actionLabel = actionLabels[input.action];
  const eventAt = resolveEventTime(input.action, input.trade);
  const tasks: Promise<unknown>[] = [];

  if (input.notifyAdmin !== false) {
    tasks.push(
      sendExchangeAdminNotification({
        action: input.action,
        actionLabel,
        trade: input.trade,
        eventAt,
        adminLink: buildAdminLink()
      }).catch((err) => {
        logWarn("exchange_admin_email_failed", {
          tradeId: input.trade.id,
          action: input.action,
          error: (err as Error).message
        });
      })
    );
  }

  if (input.notifyUser !== false && input.userPhone) {
    tasks.push(
      sendSmsMessage({
        phone: input.userPhone,
        message: smsMessages[input.action],
        reference: `exchange_${input.action}_${input.trade.id}`
      }).catch((err) => {
        logWarn("exchange_sms_failed", {
          tradeId: input.trade.id,
          action: input.action,
          error: (err as Error).message
        });
      })
    );
  }

  if (!tasks.length) {
    return;
  }

  await Promise.allSettled(tasks);
};
