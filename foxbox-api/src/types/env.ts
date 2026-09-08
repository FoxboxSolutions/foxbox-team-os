export interface Env {
  DB: D1Database;
  CACHE?: KVNamespace;
  STORAGE?: R2Bucket;
  ENVIRONMENT: string;
  JWT_SECRET: string;
  ENCRYPTION_KEY?: string;
  YOUCAN_CLIENT_ID?: string;
  YOUCAN_CLIENT_SECRET?: string;
  YOUCAN_REDIRECT_URI?: string;
  ECOM_API_KEY?: string;
  ECOM_API_TOKEN?: string;
  ECOM_WEBHOOK_SECRET?: string;
  FRONTEND_URL?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
}
