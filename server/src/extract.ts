import JSZip from "jszip";
import { extractText } from "unpdf";

const MAX_CHARS = 80_000;

function stripMarkup(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function clip(text: string) {
  if (text.length <= MAX_CHARS) return text;
  return `${text.slice(0, MAX_CHARS)}\n\n[已截断]`;
}

async function extractEpub(buf: Buffer) {
  const zip = await JSZip.loadAsync(buf);
  const names = Object.keys(zip.files)
    .filter((n) => /\.(xhtml|html|htm)$/i.test(n))
    .sort();
  const chunks: string[] = [];
  for (const name of names) {
    const file = zip.file(name);
    if (!file) continue;
    const html = await file.async("string");
    const text = stripMarkup(html);
    if (text) chunks.push(text);
  }
  return chunks.join("\n\n");
}

async function extractPdf(buf: Buffer) {
  const { text } = await extractText(new Uint8Array(buf), { mergePages: true });
  return text;
}

export async function extractUpload(filename: string, buf: Buffer) {
  const lower = filename.toLowerCase();
  try {
    if (lower.endsWith(".txt") || lower.endsWith(".md")) {
      return clip(buf.toString("utf8"));
    }
    if (lower.endsWith(".epub")) {
      return clip(await extractEpub(buf));
    }
    if (lower.endsWith(".pdf")) {
      return clip(await extractPdf(buf));
    }
    if (lower.endsWith(".html") || lower.endsWith(".htm")) {
      return clip(stripMarkup(buf.toString("utf8")));
    }
  } catch {
    return `[已保存 ${filename}，抽出正文失败。]`;
  }
  return `[已保存 ${filename}，这一版只抽取 PDF / EPUB / 文本。]`;
}
