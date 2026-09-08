import { randomBytes } from "node:crypto";
import { disposeAgents } from "./agent.js";
import { writeEnvVar } from "./envfile.js";

const CURSOR_KEY = "CURSOR_API_KEY";
const TOKEN_KEY = "WORKBENCH_TOKEN";
const PUBLIC_URL_KEY = "MCP_PUBLIC_URL";

function currentCursorKey() {
  return process.env[CURSOR_KEY]?.trim() || "";
}

function currentToken() {
  return process.env[TOKEN_KEY]?.trim() || "";
}

function defaultPublicUrl() {
  const port = process.env.PORT ?? "8787";
  return `http://127.0.0.1:${port}`;
}

function currentPublicUrl() {
  return process.env[PUBLIC_URL_KEY]?.trim().replace(/\/$/, "") || defaultPublicUrl();
}

function hintOf(key: string) {
  if (!key) return "";
  return key.length <= 4 ? key : key.slice(-4);
}

export function settingsStatus() {
  const key = currentCursorKey();
  const token = currentToken();
  const mcpPublicUrl = currentPublicUrl();
  return {
    cursorApiKeyConfigured: Boolean(key),
    cursorApiKeyHint: hintOf(key),
    workbenchTokenConfigured: Boolean(token),
    workbenchTokenHint: hintOf(token),
    mcpPublicUrl,
    mcpUrl: `${mcpPublicUrl}/mcp`,
  };
}

export async function updateSettings(patch: {
  cursorApiKey?: string;
  workbenchToken?: string;
  mcpPublicUrl?: string;
}) {
  if (typeof patch.cursorApiKey === "string") {
    const key = patch.cursorApiKey.trim();
    process.env[CURSOR_KEY] = key;
    writeEnvVar(CURSOR_KEY, key);
    await disposeAgents();
  }
  if (typeof patch.workbenchToken === "string") {
    const token = patch.workbenchToken.trim();
    process.env[TOKEN_KEY] = token;
    writeEnvVar(TOKEN_KEY, token);
  }
  if (typeof patch.mcpPublicUrl === "string") {
    const url = patch.mcpPublicUrl.trim().replace(/\/$/, "");
    process.env[PUBLIC_URL_KEY] = url;
    writeEnvVar(PUBLIC_URL_KEY, url);
  }
  return settingsStatus();
}

export function generateWorkbenchToken() {
  const token = randomBytes(24).toString("base64url");
  process.env[TOKEN_KEY] = token;
  writeEnvVar(TOKEN_KEY, token);
  return { token, ...settingsStatus() };
}

export function workbenchToken() {
  return currentToken();
}
