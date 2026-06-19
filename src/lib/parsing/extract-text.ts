import fs from "fs/promises";
import path from "path";

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfMod: any = await import("pdf-parse");
    const pdfParse = pdfMod.default ?? pdfMod;
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

  // Fallback: treat as UTF-8 text
  return {
    name: filename,
    text: buffer.toString("utf-8").slice(0, 50_000),
    mimeType: "application/octet-stream",
  };
}
