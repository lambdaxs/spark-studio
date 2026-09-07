import fs from "node:fs";
import path from "node:path";
import { workspaceRoot } from "./db.js";
import { disposeAgents } from "./agent.js";

const envPath = path.join(workspaceRoot, ".env");
const KEY = "CURSOR_API_KEY";

function currentKey() {
  return process.env[KEY]?.trim() || "";
}

function hintOf(key: string) {
  if (!key) return "";
  return key.length <= 4 ? key : key.slice(-4);
}

function writeEnvVar(name: string, value: string) {
  let text = "";
  try {
    text = fs.readFileSync(envPath, "utf8");
  } catch {
    text = "";
  }
  const line = `${name}=${value}`;
  const re = new RegExp(`^${name}=.*$`, "m");
  if (re.test(text)) text = text.replace(re, line);
  else text = `${text.replace(/\s*$/, "")}${text ? "\n" : ""}${line}\n`;
  fs.writeFileSync(envPath, text.endsWith("\n") ? text : `${text}\n`);
}

export function settingsStatus() {
  const key = currentKey();
  return {
    cursorApiKeyConfigured: Boolean(key),
    cursorApiKeyHint: hintOf(key),
  };
}

export async function setCursorApiKey(raw: string) {
  const key = raw.trim();
  process.env[KEY] = key;
  writeEnvVar(KEY, key);
  await disposeAgents();
  return settingsStatus();
}
