import { Prisma } from "@prisma/client";

export const asJson = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;
