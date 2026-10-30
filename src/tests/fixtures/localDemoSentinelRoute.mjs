/** Reads env at import time, the same moment a route module would. */
export const observed = {
  sendgrid: process.env.SENDGRID_API_KEY || '',
  stripe: process.env.STRIPE_SECRET_KEY || '',
  webhook: process.env.STRIPE_WEBHOOK_SECRET || '',
  auditUrl: process.env.AUDIT_DATABASE_URL || '',
  apiKey: process.env.API_KEY || '',
  credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
  gemini: process.env.GEMINI_API_KEY || '',
  sentinel: process.env.SENTINEL_FROM_FILE || '',
};
