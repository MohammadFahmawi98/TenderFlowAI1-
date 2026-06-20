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
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  }

  // Legacy .doc — mammoth sometimes handles it, fallback to raw text if it fails
  if (ext === ".doc") {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      if (result.value.length > 50) {
        return { name: filename, text: result.value, mimeType: "application/msword" };
      }
    } catch {
      // fall through to raw extraction below
    }
    return {
      name: filename,
      text: buffer.toString("latin1").replace(/[^\x20-\x7E\n\r\t-￿]/g, " "),
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
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }

  if (ext === ".txt" || ext === ".md") {
    return {
      name: filename,
      text: buffer.toString("utf-8"),
      mimeType: "text/plain",
    };
  }

  // .pptx — extract text from slide XML inside the ZIP
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
        // Extract text from <a:t> tags
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
        mimeType:
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      };
    } catch {
      // fall through to raw extraction
    }
  }

  // Generic fallback: return raw text (works for plain-text files with unknown extensions)
  return {
    name: filename,
    text: buffer.toString("utf-8").slice(0, 50_000),
    mimeType: "application/octet-stream",
  };
}
