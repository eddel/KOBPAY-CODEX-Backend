import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const phone = "+2348000000000";

  const user = await prisma.user.upsert({
    where: { phone },
    update: {},
    create: {
      phone,
      name: "Demo User"
    }
  });

  await prisma.wallet.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      balanceKobo: 0,
      currency: "NGN"
    }
  });

  console.log(`Seeded demo user: ${user.phone}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
