import path from "path";
import { env } from "./env.js";

export const uploadsRootDir = path.resolve(process.cwd(), env.UPLOADS_DIR);

export const resolveUploadPath = (...segments: string[]) =>
  path.join(uploadsRootDir, ...segments);
