import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const getArg = (name: string) => {
  const idx = args.findIndex((arg) => arg === `--${name}`);
  if (idx === -1) {
    return null;
  }
  return args[idx + 1] ?? null;
};

const usage = () => {
  console.log("Usage:");
  console.log("  npx tsx scripts/fundWallet.ts --phone 081... --amount 100000");
  console.log("  npx tsx scripts/fundWallet.ts --user-id <uuid> --amount 100000");
  console.log("  npx tsx scripts/fundWallet.ts --phone 081... --amount-kobo 10000000");
};

const normalizeDigits = (value: string) => value.replace(/\D/g, "");

const resolveUser = async (userId: string | null, phone: string | null) => {
  if (userId) {
    return prisma.user.findUnique({ where: { id: userId } });
  }

  if (!phone) {
    return null;
  }

  const raw = phone.trim();
  const digits = normalizeDigits(raw);
  const candidates = new Set<string>();

  if (raw) {
    candidates.add(raw);
  }
  if (digits) {
    candidates.add(digits);
  }

  if (digits.length === 11 && digits.startsWith("0")) {
    const intl = `234${digits.slice(1)}`;
    candidates.add(intl);
    candidates.add(`+${intl}`);
  }

  if (digits.length === 13 && digits.startsWith("234")) {
    const local = `0${digits.slice(3)}`;
    candidates.add(local);
    candidates.add(`+${digits}`);
  }

  const matchList = Array.from(candidates).filter(Boolean);
  if (matchList.length) {
    const matches = await prisma.user.findMany({
      where: { phone: { in: matchList } }
    });

    if (matches.length === 1) {
      return matches[0];
    }

    if (matches.length > 1) {
      console.error("Multiple users matched the phone candidates:");
      matches.forEach((user) => {
        console.error(`- ${user.id} (${user.phone})`);
      });
      return null;
    }
  }

  if (digits) {
    const partialMatches = await prisma.user.findMany({
      where: { phone: { contains: digits } }
    });

    if (partialMatches.length === 1) {
      return partialMatches[0];
    }

    if (partialMatches.length > 1) {
      console.error("Multiple users matched the phone digits:");
      partialMatches.forEach((user) => {
        console.error(`- ${user.id} (${user.phone})`);
      });
    }
  }

  return null;
};

const main = async () => {
  const phone = getArg("phone") ?? getArg("user-phone");
  const userId = getArg("user-id") ?? getArg("userId");
  const amountRaw = getArg("amount") ?? getArg("amount-ngn");
  const amountKoboRaw = getArg("amount-kobo");

  if (!phone && !userId) {
    console.error("Missing --phone or --user-id.");
    usage();
    process.exitCode = 1;
    return;
  }

  if (!amountRaw && !amountKoboRaw) {
    console.error("Missing --amount or --amount-kobo.");
    usage();
    process.exitCode = 1;
    return;
  }

  const amountKobo =
    amountKoboRaw !== null
      ? Number(amountKoboRaw)
      : Number(amountRaw ?? 0) * 100;

  if (!Number.isFinite(amountKobo) || amountKobo <= 0) {
    console.error("Amount must be a positive number.");
    process.exitCode = 1;
    return;
  }

  const user = await resolveUser(userId, phone);
  if (!user) {
    console.error("User not found.");
    process.exitCode = 1;
    return;
  }

  const providerRef = `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const result = await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        balanceKobo: Math.round(amountKobo),
        currency: "NGN"
      },
      update: {
        balanceKobo: { increment: Math.round(amountKobo) },
        currency: "NGN"
      }
    });

    const transaction = await tx.transaction.create({
      data: {
        userId: user.id,
        type: "credit",
        category: "wallet_funding",
        amountKobo: Math.round(amountKobo),
        feeKobo: 0,
        totalKobo: Math.round(amountKobo),
        provider: "manual",
        providerRef,
        status: "successful",
        metaJson: {
          source: "test_fund",
          note: "Manual wallet top-up for testing",
          amountNgn: Number((Math.round(amountKobo) / 100).toFixed(2)),
          amountKobo: Math.round(amountKobo)
        }
      }
    });

    return { wallet, transaction };
  });

  console.log(
    `Funded ${user.phone} (${user.id}) with NGN ${(Math.round(amountKobo) / 100).toFixed(2)}.`
  );
  console.log(`New balance: ${result.wallet.balanceKobo} kobo.`);
  console.log(`Transaction: ${result.transaction.id}.`);
};

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
