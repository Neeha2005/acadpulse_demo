import "dotenv/config";

export const config = {
  fastApiBaseUrl: process.env.FASTAPI_BASE_URL || "http://localhost:8000",
  logLevel: process.env.LOG_LEVEL || "info",
};
