import { prisma } from "../db.js";
import { env } from "../config/env.js";

export const SMS_PROVIDER_SETTING_KEY = "SMS_PROVIDER";

export const smsProviders = ["DEV", "BULKSMS", "TRACKSEND"] as const;
export type SmsProvider = (typeof smsProviders)[number];

export const isSmsProvider = (value: string): value is SmsProvider =>
  smsProviders.includes(value as SmsProvider);

export const getEnvSmsProvider = (): SmsProvider =>
  isSmsProvider(env.OTP_PROVIDER) ? env.OTP_PROVIDER : "DEV";

export const getActiveSmsProvider = async (): Promise<SmsProvider> => {
  const setting = await prisma.appSetting.findUnique({
    where: { key: SMS_PROVIDER_SETTING_KEY }
  });

  const value = setting?.value?.trim().toUpperCase();
  return value && isSmsProvider(value) ? value : getEnvSmsProvider();
};

export const setActiveSmsProvider = async (provider: SmsProvider) => {
  await prisma.appSetting.upsert({
    where: { key: SMS_PROVIDER_SETTING_KEY },
    update: { value: provider },
    create: { key: SMS_PROVIDER_SETTING_KEY, value: provider }
  });
};
