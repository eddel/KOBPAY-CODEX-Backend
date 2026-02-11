CREATE TABLE "ExchangeTrade" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromCurrency" TEXT NOT NULL,
    "toCurrency" TEXT NOT NULL,
    "fromAmountMinor" INTEGER NOT NULL,
    "toAmountMinor" INTEGER NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "rateSource" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "paymentReceivedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "receivingDetailsJson" JSONB NOT NULL,
    "payToDetailsJson" JSONB NOT NULL,
    "receiptFileUrl" TEXT,
    "receiptFileName" TEXT,
    "receiptMimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeTrade_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExchangeTrade_userId_idx" ON "ExchangeTrade"("userId");
CREATE INDEX "ExchangeTrade_status_idx" ON "ExchangeTrade"("status");
CREATE INDEX "ExchangeTrade_expiresAt_idx" ON "ExchangeTrade"("expiresAt");

ALTER TABLE "ExchangeTrade"
ADD CONSTRAINT "ExchangeTrade_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
