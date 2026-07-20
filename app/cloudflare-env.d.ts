interface CloudflareEnv {
  DB: D1Database;
  SESSION_SECRET: string;
  SMTP_HOST: string;
  SMTP_PORT: string;
  SMTP_USER: string;
  SMTP_PASS: string;
  SMTP_FROM: string;
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL: string;
  APP_BASE_URL: string;
}
