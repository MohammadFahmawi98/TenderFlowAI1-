import { createRequire } from "module";
import path from "path";

const _require = createRequire(import.meta.url);

export interface ExtractedFile {
  name: string;
  text: string;
  mimeType: string;
}

export async function extractText(
  buffer: Buffer,
  filename: string,
): Promise<ExtractedFile> {
  const ext = path.extname(filename).toLowerCase();

  if (ext === ".pdf") {
    const pdfParse: (buf: Buffer) => Promise<{ text: string }> =
      _require("pdf-parse");
    const data = await pdfParse(buffer);
    return { name: filename, text: data.text, mimeType: "application/pdf" };
  }

  if (ext === ".docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return {
      name: filename,
      text: result.value,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  }

  // Legacy .doc (OLE2 binary) - try multiple strategies, never throw
  if (ext === ".doc") {
    // Strategy 1: mammoth (works for some .doc files)
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      if (result.value.trim().length > 100) {
        return { name: filename, text: result.value, mimeType: "application/msword" };
      }
    } catch {
      // mammoth failed for this binary format, continue
    }

    // Strategy 2: UTF-16 LE (Word stores text internally as UTF-16LE)
    // Effective for Arabic, Farsi, and other non-Latin .doc files
    try {
      const utf16 = buffer.toString("utf16le");
      // Keep Arabic block (U+0600-U+06FF), printable ASCII, whitespace
      const readable = utf16
        .split("")
        .filter((ch) => {
          const cp = ch.codePointAt(0) ?? 0;
          return (cp >= 0x0600 && cp <= 0x06FF) || (cp >= 0x20 && cp <= 0x7E) || cp === 0x0A || cp === 0x0D || cp === 0x09;
        })
        .join("")
        .replace(/\s{3,}/g, "\n")
        .trim();
      if (readable.length > 100) {
        return { name: filename, text: readable, mimeType: "application/msword" };
      }
    } catch {
      // ignore
    }

    // Strategy 3: Extract contiguous printable ASCII sequences from raw bytes
    const chunks: string[] = [];
    let current = "";
    const limit = Math.min(buffer.length, 500_000);
    for (let i = 0; i < limit; i++) {
      const byte = buffer[i];
      if (byte >= 32 && byte <= 126) {
        current += String.fromCharCode(byte);
      } else {
        if (current.length >= 6) chunks.push(current);
        current = "";
      }
    }
    if (current.length >= 6) chunks.push(current);

    const asciiText = chunks.join(" ").replace(/\s{2,}/g, " ").trim();
    if (asciiText.length > 50) {
      return { name: filename, text: asciiText, mimeType: "application/msword" };
    }

    // Final fallback: mark as done with a note (never fail a .doc file)
    return {
      name: filename,
      text: `[Binary .doc file - limited text extraction. Filename: ${filename}. Consider converting to .docx for better results.]`,
      mimeType: "application/msword",
    };
  }

  if (ext === ".xlsx" || ext === ".xls" || ext === ".csv") {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheets = workbook.SheetNames.map((name) => {
      const sheet = workbook.Sheets[name];
      return `--- Sheet: ${name} ---\n${XLSX.utils.sheet_to_csv(sheet)}`;
    });
    return {
      name: filename,
      text: sheets.join("\n\n"),
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }

  if (ext === ".txt" || ext === ".md") {
    return {
      name: filename,
      text: buffer.toString("utf-8"),
      mimeType: "text/plain",
    };
  }

  // .pptx - extract text from slide XML inside the ZIP
  if (ext === ".pptx") {
    try {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(buffer);
      const slideTexts: string[] = [];

      const slideEntries = Object.entries(zip.files)
        .filter(([name]) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
        .sort(([a], [b]) => a.localeCompare(b));

      for (const [, file] of slideEntries) {
        const xml = await file.async("text");
        const matches = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) ?? [];
        const text = matches
          .map((m) => m.replace(/<[^>]+>/g, ""))
          .join(" ")
          .trim();
        if (text) slideTexts.push(text);
      }

      return {
        name: filename,
        text: slideTexts.join("\n"),
        mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      };
    } catch {
      // fall through
    }
  }

  // Generic fallback
  return {
    name: filename,
    text: buffer.toString("utf-8").slice(0, 50_000),
    mimeType: "application/octet-stream",
  };
}
