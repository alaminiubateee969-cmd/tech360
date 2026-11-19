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
const SECRET_NAMES = ["SESSION_SECRET", "PORTAL_SECRET", "OPS_SECRET", "IDENTITY_HASH_SECRET", "EMAIL_WEBHOOK_SECRET"];
const errors = [];

if (process.env.NODE_ENV !== "production") {
  errors.push("NODE_ENV (must be production)");
}

for (const name of REQUIRED) {
  if (!process.env[name]?.trim()) errors.push(`${name} (required)`);
}

if ((process.env.WHATSAPP_APP_SECRET?.trim() || process.env.WHATSAPP_TOKEN?.trim()) && !process.env.IDENTITY_HASH_SECRET?.trim()) {
  errors.push("IDENTITY_HASH_SECRET (required when a WhatsApp integration is configured)");
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

// Preview-only SQLite must never be active in production. The runtime adapter
// (src/lib/preview-db.ts) also throws, but refusing here means the process does
// not start at all rather than failing on the first query.
if (process.env.PREVIEW_SQLITE_URL?.trim()) {
  errors.push("PREVIEW_SQLITE_URL (development-only; unset it and use a mysql:// DATABASE_URL)");
}

const aiOpsDriver = process.env.AI_OPS_DRIVER?.trim().toLowerCase();
if (aiOpsDriver && !["on", "off"].includes(aiOpsDriver)) {
  errors.push("AI_OPS_DRIVER (must be on or off)");
}

// Require the explicitly selected provider, or at least one complete path in
// automatic mode. Never silently substitute another (possibly billable)
// provider for an invalid or incompletely configured explicit choice. Keep
// configured endpoint safety checks; never print credentials or values.
const hasZai = Boolean(process.env.ZAI_BASE_URL?.trim() && process.env.ZAI_API_KEY?.trim());
const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY?.trim());
const hasOpenAi = Boolean(process.env.OPENAI_API_KEY?.trim());
const hasGemini = Boolean((process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY)?.trim());
const hasGroq = Boolean(process.env.GROQ_API_KEY?.trim());
const explicitAiDisabled = ["none", "off", "disabled"].includes((process.env.AI_PROVIDER ?? "").trim().toLowerCase());
const gatewayBaseUrl = process.env.AI_GATEWAY_BASE_URL?.trim();
const gatewayToken = process.env.AGENTOS_GATEWAY_TOKEN?.trim();
let hasGateway = Boolean(gatewayBaseUrl && gatewayToken);
if (gatewayBaseUrl) {
  try {
    const parsed = new URL(gatewayBaseUrl);
    if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password || parsed.search || parsed.hash) {
      errors.push("AI_GATEWAY_BASE_URL (must be an absolute HTTP(S) URL without credentials or query data)");
      hasGateway = false;
    }
  } catch {
    errors.push("AI_GATEWAY_BASE_URL (invalid URL)");
    hasGateway = false;
  }
}
if (gatewayBaseUrl && !gatewayToken) errors.push("AGENTOS_GATEWAY_TOKEN (required with AI_GATEWAY_BASE_URL)");
if (gatewayToken && !gatewayBaseUrl) errors.push("AI_GATEWAY_BASE_URL (required with AGENTOS_GATEWAY_TOKEN)");
const preferredAi = (process.env.AI_PROVIDER ?? "").trim().toLowerCase();
const providerConfigurations = new Map([
  ["ai-gateway", hasGateway], ["gateway", hasGateway], ["aigateway", hasGateway],
  ["openrouter", hasOpenRouter], ["openai", hasOpenAi], ["gemini", hasGemini],
  ["google", hasGemini], ["google-gemini", hasGemini], ["groq", hasGroq], ["zai", hasZai],
]);
if (preferredAi && preferredAi !== "auto" && !explicitAiDisabled) {
  if (!providerConfigurations.has(preferredAi)) {
    errors.push("AI_PROVIDER (must select ai-gateway, openrouter, openai, gemini, groq, zai, auto, or none)");
  } else if (!providerConfigurations.get(preferredAi)) {
    errors.push("AI_PROVIDER (selected provider requires its complete configuration; automatic fallback is disabled)");
  }
}
if (!hasZai && !hasOpenRouter && !hasOpenAi && !hasGemini && !hasGroq && !hasGateway && !explicitAiDisabled) {
  errors.push("AI provider (configure OPENAI_API_KEY, GEMINI_API_KEY, GROQ_API_KEY, AI_GATEWAY_BASE_URL + AGENTOS_GATEWAY_TOKEN, OPENROUTER_API_KEY, ZAI_BASE_URL + ZAI_API_KEY, or AI_PROVIDER=none)");
}

const zaiBaseUrl = process.env.ZAI_BASE_URL;
if (zaiBaseUrl) {
  try {
    const parsed = new URL(zaiBaseUrl);
    if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password || parsed.search || parsed.hash) {
      errors.push("ZAI_BASE_URL (must be an absolute HTTP(S) URL without credentials or query data)");
    }
  } catch {
    errors.push("ZAI_BASE_URL (invalid URL)");
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
