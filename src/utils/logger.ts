import { env } from "../config/env.js";

type LogLevel = "debug" | "info" | "warn" | "error";

const isDebug = env.LOG_LEVEL?.toLowerCase() === "debug";

const writeLog = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
  const payload = {
    level,
    message,
    ts: new Date().toISOString(),
    ...(meta ?? {})
  };

  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
};

export const logDebug = (message: string, meta?: Record<string, unknown>) => {
  if (!isDebug) return;
  writeLog("debug", message, meta);
};

export const logInfo = (message: string, meta?: Record<string, unknown>) => {
  writeLog("info", message, meta);
};

export const logWarn = (message: string, meta?: Record<string, unknown>) => {
  writeLog("warn", message, meta);
};

export const logError = (message: string, meta?: Record<string, unknown>) => {
  writeLog("error", message, meta);
};

export const shouldLogDebug = () => isDebug;

