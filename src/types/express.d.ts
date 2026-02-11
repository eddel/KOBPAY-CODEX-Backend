import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Request {
    auth?: {
      userId: string;
      phone: string;
    };
    rawBody?: Buffer;
    requestId?: string;
    file?: Express.Multer.File;
  }
}
