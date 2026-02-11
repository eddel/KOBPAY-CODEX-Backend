import { type Request, type Response, type NextFunction } from "express";
import { unauthorized } from "../errors";
import { verifyAccessToken } from "../services/tokenService";

const extractToken = (req: Request) => {
  const header = req.headers.authorization;
  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token.trim();
};

export const authMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  const token = extractToken(req);
  if (!token) {
    return next(unauthorized("Missing access token"));
  }

  const payload = verifyAccessToken(token);
  req.auth = { userId: payload.sub, phone: payload.phone };
  return next();
};
