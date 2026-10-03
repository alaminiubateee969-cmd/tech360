#!/usr/bin/env node
/** Fail closed before the production Next.js server starts. Never print values. */

const REQUIRED = [
  "DATABASE_URL",
  "APP_PUBLIC_URL",
  "APP_ORIGIN",
  "SESSION_SECRET",
  "PORTAL_SECRET",
  "OPS_SECRET",
];
const SECRET_NAMES = ["SESSION_SECRET", "PORTAL_SECRET", "OPS_SECRET"];
const errors = [];

if (process.env.NODE_ENV !== "production") {
  errors.push("NODE_ENV (must be production)");
}

for (const name of REQUIRED) {
  if (!process.env[name]?.trim()) errors.push(`${name} (required)`);
}

function isCanonicalHttpsOrigin(value) {
  try {
    const parsed = new URL(value);
    return parsed.origin === "https://bdtech360.com"
      && parsed.protocol === "https:"
      && parsed.username === ""
      && parsed.password === ""
      && parsed.pathname === "/"
      && parsed.search === ""
      && parsed.hash === "";
  } catch {
    return false;
  }
}

for (const name of ["APP_PUBLIC_URL", "APP_ORIGIN"]) {
  const value = process.env[name];
  if (value && !isCanonicalHttpsOrigin(value)) {
    errors.push(`${name} (must be the canonical HTTPS origin https://bdtech360.com)`);
  }
}

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl) {
  try {
    const parsed = new URL(databaseUrl);
    if (parsed.protocol !== "mysql:" || !parsed.hostname || !parsed.username || !parsed.password || parsed.pathname.length <= 1) {
      errors.push("DATABASE_URL (must be a credentialed mysql:// URL with a database name)");
    }
  } catch {
    errors.push("DATABASE_URL (invalid URL; expected mysql://)");
  }
}

for (const name of SECRET_NAMES) {
  const value = process.env[name];
  if (!value) continue;
  if (Buffer.byteLength(value, "utf8") < 32) {
    errors.push(`${name} (must contain at least 32 characters)`);
  } else if (/\s/.test(value) || new Set(value).size < 8) {
    errors.push(`${name} (must be a non-trivial random value without whitespace)`);
  }
}

for (let left = 0; left < SECRET_NAMES.length; left += 1) {
  for (let right = left + 1; right < SECRET_NAMES.length; right += 1) {
    const a = process.env[SECRET_NAMES[left]];
    const b = process.env[SECRET_NAMES[right]];
    if (a && b && a === b) {
      errors.push(`${SECRET_NAMES[left]} and ${SECRET_NAMES[right]} (must be distinct secrets)`);
    }
  }
}

if (errors.length > 0) {
  console.error("[startup-config] production environment validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("[startup-config] required production environment checks passed");
}
