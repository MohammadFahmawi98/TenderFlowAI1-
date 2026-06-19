import { readdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { join, extname } from "path";

// All byte patterns confirmed from hex dumps of the actual files.
// Pattern: UTF-8 bytes of characters that were read as Windows-1252 and then re-encoded as UTF-8.
const replacements = [
  // — em dash U+2014 (E2 80 94 → cp1252: â€" → utf8: c3 a2 e2 82 ac e2 80 9d)
  [Buffer.from([0xC3,0xA2,0xE2,0x82,0xAC,0xE2,0x80,0x9D]), "—"],
  // … ellipsis U+2026 (E2 80 A6 → cp1252: â€¦ → utf8: c3 a2 e2 82 ac c2 a6)
  [Buffer.from([0xC3,0xA2,0xE2,0x82,0xAC,0xC2,0xA6]), "…"],
  // → right arrow U+2192 (E2 86 92 → cp1252: â†' → utf8: c3 a2 e2 80 a0 e2 80 99)
  [Buffer.from([0xC3,0xA2,0xE2,0x80,0xA0,0xE2,0x80,0x99]), "→"],
  // ★ black star U+2605 (E2 98 85 → cp1252: â˜… → utf8: c3 a2 cb 9c e2 80 a6)
  [Buffer.from([0xC3,0xA2,0xCB,0x9C,0xE2,0x80,0xA6]), "★"],
  // ☆ white star U+2606 (E2 98 86 → cp1252: â˜† → utf8: c3 a2 cb 9c e2 80 a0)
  [Buffer.from([0xC3,0xA2,0xCB,0x9C,0xE2,0x80,0xA0]), "☆"],
  // · middle dot U+00B7 (C2 B7 → cp1252: Â· → utf8: c3 82 c2 b7)
  [Buffer.from([0xC3,0x82,0xC2,0xB7]), "·"],
  // ' apostrophe U+2019 (E2 80 99 → cp1252: â€™ → utf8: c3 a2 e2 82 ac e2 84 a2)
  [Buffer.from([0xC3,0xA2,0xE2,0x82,0xAC,0xE2,0x84,0xA2]), "'"],
];

function replaceAll(buf, search, replaceStr) {
  const replace = Buffer.from(replaceStr);
  const parts = [];
  let i = 0;
  while (i < buf.length) {
    if (i + search.length <= buf.length && buf.slice(i, i + search.length).equals(search)) {
      parts.push(replace);
      i += search.length;
    } else {
      parts.push(buf.slice(i, i + 1));
      i++;
    }
  }
  return Buffer.concat(parts);
}

let totalFixed = 0;

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (!["node_modules", ".next", ".git"].includes(entry)) walk(full);
    } else if ([".tsx", ".ts", ".css"].includes(extname(entry))) {
      let buf = readFileSync(full);
      let changed = false;
      for (const [bad, good] of replacements) {
        if (buf.includes(bad)) {
          buf = replaceAll(buf, bad, good);
          changed = true;
        }
      }
      if (changed) {
        writeFileSync(full, buf);
        console.log("Fixed:", entry);
        totalFixed++;
      }
    }
  }
}

walk("./src");
console.log(`Done — fixed ${totalFixed} file(s).`);
