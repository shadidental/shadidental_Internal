/** Central settings, read from environment variables (see .env.example). */
export const config = {
  orgName: process.env.ORG_NAME || "Shadi International Dental Center",
  orgShort: process.env.ORG_SHORT_NAME || "SIDC",
  appUrl: (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, ""),
  assetTagPrefix: process.env.ASSET_TAG_PREFIX || "SIDC",
  /** Shared IT mailbox: receives HR requests, is the sender of portal email. */
  itMailbox: process.env.IT_MAILBOX || "it@example.com",
  /** Shared HR mailbox: copied on every request email. */
  hrMailbox: process.env.HR_MAILBOX || "",
  mailFrom: process.env.MAIL_FROM || process.env.IT_MAILBOX || "it@example.com",
  sessionHours: Number(process.env.SESSION_HOURS || 10),
  mfaRequired: process.env.MFA_REQUIRED !== "false",
  timezone: "Asia/Dubai",
};
