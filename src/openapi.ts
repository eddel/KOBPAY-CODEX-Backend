export const openapiSpec = {
  openapi: "3.0.0",
  info: {
    title: "KOBPAY API",
    version: "0.1.0"
  },
  paths: {
    "/api/health": {
      get: {
        summary: "Health check",
        responses: {
          "200": {
            description: "OK"
          }
        }
      }
    }
  }
};
