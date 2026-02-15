import jwt, { type JwtPayload } from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "../errors.js";

type TokenType = "access" | "refresh";

export type AccessTokenPayload = {
  sub: string;
  phone: string;
  type: "access";
};

export type RefreshTokenPayload = {
  sub: string;
  phone: string;
  type: "refresh";
};

const buildPayload = (userId: string, phone: string, type: TokenType) => ({
  sub: userId,
  phone,
  type
});

const isAccessPayload = (
  payload: JwtPayload | string
): payload is AccessTokenPayload => {
  if (!payload || typeof payload === "string") {
    return false;
  }
  return (
    typeof payload.sub === "string" &&
    typeof payload.phone === "string" &&
    payload.type === "access"
  );
};

const isRefreshPayload = (
  payload: JwtPayload | string
): payload is RefreshTokenPayload => {
  if (!payload || typeof payload === "string") {
    return false;
  }
  return (
    typeof payload.sub === "string" &&
    typeof payload.phone === "string" &&
    payload.type === "refresh"
  );
};

const signToken = (userId: string, phone: string, type: TokenType) => {
  const secret = type === "access" ? env.JWT_ACCESS_SECRET : env.JWT_REFRESH_SECRET;
  const expiresIn =
    type === "access" ? env.JWT_ACCESS_TTL_SECONDS : env.JWT_REFRESH_TTL_SECONDS;

  return jwt.sign(buildPayload(userId, phone, type), secret, {
    expiresIn
  });
};

export const issueTokens = (userId: string, phone: string) => {
  const accessToken = signToken(userId, phone, "access");
  const refreshToken = signToken(userId, phone, "refresh");

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresIn: env.JWT_ACCESS_TTL_SECONDS,
    refreshTokenExpiresIn: env.JWT_REFRESH_TTL_SECONDS
  };
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
    if (!isAccessPayload(payload)) {
      throw new AppError(401, "Invalid access token", "AUTH_INVALID");
    }
    return payload;
  } catch (err) {
    throw new AppError(401, "Invalid or expired access token", "AUTH_INVALID", err);
  }
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
    if (!isRefreshPayload(payload)) {
      throw new AppError(401, "Invalid refresh token", "AUTH_INVALID");
    }
    return payload;
  } catch (err) {
    throw new AppError(401, "Invalid or expired refresh token", "AUTH_INVALID", err);
  }
};

