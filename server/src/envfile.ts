import fs from "node:fs";
import path from "node:path";
import { workspaceRoot } from "./db.js";

export const envPath = path.join(workspaceRoot, ".env");

export function writeEnvVar(name: string, value: string) {
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
