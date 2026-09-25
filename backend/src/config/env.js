import "dotenv/config";
import path from "node:path";

function required(name) {
  const value = process.env[name];
  if (value === undefined || value === "") throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function integer(name, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Invalid numeric environment variable: ${name}`);
  return value;
}

function secret(name) {
  const value = required(name);
  if (value.length < 32) throw new Error(`${name} must contain at least 32 characters`);
  return value;
}

function encryptionKey(name) {
  const value = required(name);
  const decoded = Buffer.from(value, "base64url");
  if (decoded.length !== 32) throw new Error(`${name} must decode to exactly 32 bytes`);
  return decoded;
}

function boolean(name, fallback = false) {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`Invalid boolean environment variable: ${name}`);
}

function csvSet(name, fallback = "") {
  const values = (process.env[name] ?? fallback)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!values.length) throw new Error(`${name} must contain at least one value`);
  return new Set(values);
}

function emailConfig() {
  const enabled = boolean("EMAIL_ENABLED", false);
  return Object.freeze({
    enabled,
    host: enabled ? required("SMTP_HOST") : process.env.SMTP_HOST ?? "",
    port: integer("SMTP_PORT", 587, { max: 65535 }),
    secure: boolean("SMTP_SECURE", false),
    clinicEmail: enabled ? required("CLINIC_EMAIL_ADDRESS") : process.env.CLINIC_EMAIL_ADDRESS ?? "",
    appPassword: enabled ? required("CLINIC_EMAIL_APP_PASSWORD") : process.env.CLINIC_EMAIL_APP_PASSWORD ?? "",
  });
}

function clinicalImageConfig() {
  const storageRoot = path.resolve(process.env.CLINICAL_IMAGE_STORAGE_ROOT ?? "private-data/clinical-images");
  const publicRoot = path.resolve(process.cwd(), "../frontend/public");
  if (storageRoot === publicRoot || storageRoot.startsWith(`${publicRoot}${path.sep}`)) throw new Error("CLINICAL_IMAGE_STORAGE_ROOT must not be inside frontend/public");
  return Object.freeze({ storageRoot, maxBytes: integer("CLINICAL_IMAGE_MAX_BYTES", 8 * 1024 * 1024, { max: 20 * 1024 * 1024 }) });
}

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: integer("PORT", 5000, { max: 65535 }),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
  db: Object.freeze({
    host: required("DB_HOST"),
    port: integer("DB_PORT", 3306, { max: 65535 }),
    database: required("DB_NAME"),
    user: required("DB_USER"),
    password: process.env.DB_PASSWORD ?? "",
    connectionLimit: integer("DB_CONNECTION_LIMIT", 10, { max: 100 }),
    connectTimeoutMs: integer("DB_CONNECT_TIMEOUT_MS", 5000, { max: 60000 }),
  }),
  jwt: Object.freeze({
    accessSecret: secret("JWT_ACCESS_SECRET"),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
    refreshSecret: secret("JWT_REFRESH_SECRET"),
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
  }),
  bcryptSaltRounds: integer("BCRYPT_SALT_ROUNDS", 12, { min: 10, max: 15 }),
  passwordResetTokenTtlMinutes: integer("PASSWORD_RESET_TOKEN_TTL_MINUTES", 30, { min: 5, max: 1440 }),
  bookingDoctorIds: csvSet("BOOKING_DOCTOR_IDS", "DOC-DEV-ROSNI,DOC-DEV-DOCTOR-B,DOC-CLINIC-NORA"),
  crypto: Object.freeze({
    activeKeyVersion: 1,
    dataKeys: new Map([[1, encryptionKey("DATA_ENCRYPTION_KEY_V1")]]),
    identityBlindIndexKey: secret("IDENTITY_BLIND_INDEX_KEY"),
    phoneBlindIndexKey: secret("PHONE_BLIND_INDEX_KEY"),
  }),
  email: emailConfig(),
  clinicalImages: clinicalImageConfig(),
  dentalChart: Object.freeze({
    catalogueDisclaimer: process.env.DENTAL_CHART_CATALOGUE_DISCLAIMER ?? "Prototype Dental Chart definitions require review by an authorised dental professional before clinical deployment.",
  }),
  googlePlaces: Object.freeze({
    apiKey: process.env.GOOGLE_PLACES_API_KEY ?? "",
    placeId: process.env.GOOGLE_PLACE_ID ?? "",
    timeoutMs: integer("GOOGLE_PLACES_TIMEOUT_MS", 5000, { max: 30000 }),
    cacheTtlMs: integer("GOOGLE_REVIEWS_CACHE_TTL_MS", 3600000, { max: 86400000 }),
  }),
});
