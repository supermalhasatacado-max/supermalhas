declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    ADMIN_EMAILS?: string;
    PAGARME_SECRET_KEY?: string;
    PAGARME_ENVIRONMENT?: string;
    PAGARME_WEBHOOK_SECRET?: string;
    RESEND_API_KEY?: string;
  }
}
