// Shared markdown/text → styled HTML converter used by run-agents and documents API

function b(s: string): string {
  return s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function parseMarkdownTable(lines: string[]): string {
  const rows = lines.map((l) =>
    l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim()),
  );
  if (rows.length === 0) return "";
  const sepIdx = rows.findIndex((r) => r.every((c) => /^[-: ]+$/.test(c)));
  const header = rows[0];
  const data = rows.filter((_, i) => i !== 0 && i !== sepIdx);
  const th = `padding:9px 14px;text-align:left;font-weight:600;font-size:12px;background:#8B3520;color:white;border:1px solid #7a2d1a;white-space:nowrap`;
  const td = (odd: boolean) =>
    `padding:8px 14px;font-size:12.5px;border:1px solid #e5e7eb;vertical-align:top;line-height:1.5;background:${odd ? "#fdf9f7" : "white"}`;
  const thead = `<thead><tr>${header.map((h) => `<th style="${th}">${h}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${data.map((row, ri) =>
    `<tr>${row.map((cell) => `<td style="${td(ri % 2 === 1)}">${b(cell)}</td>`).join("")}</tr>`,
  ).join("")}</tbody>`;
  return `<div style="overflow-x:auto;margin:14px 0"><table style="width:100%;border-collapse:collapse;border-radius:6px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08)">${thead}${tbody}</table></div>`;
}

export function textToHtml(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const t = raw.trim();
    if (!t) { i++; continue; }

    if (t.startsWith("|")) {
      const tbl: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) tbl.push(lines[i++]);
      out.push(parseMarkdownTable(tbl));
      continue;
    }

    if (/^#{1,3}\s/.test(t)) {
      const lvl = t.match(/^(#+)/)?.[1].length ?? 1;
      const txt = t.replace(/^#+\s+/, "");
      out.push(
        lvl <= 2
          ? `<h2 style="font-weight:700;font-size:16px;margin:22px 0 8px;color:#1a1a1a;border-bottom:2px solid #C8A24A;padding-bottom:5px">${txt}</h2>`
          : `<h3 style="font-weight:600;font-size:14px;margin:16px 0 6px;color:#1a1a1a">${txt}</h3>`,
      );
      i++; continue;
    }

    if (/^(\d+\.\s+)?[A-Z][A-Z\s\d&./:(),-]{2,79}$/.test(t)) {
      out.push(`<h3 style="font-weight:700;font-size:13px;margin:20px 0 7px;color:#8B3520;letter-spacing:0.04em">${t}</h3>`);
      i++; continue;
    }

    if (/^[-•*]\s/.test(t)) {
      const items: string[] = [];
      while (i < lines.length && /^[-•*]\s/.test(lines[i].trim())) {
        items.push(b(lines[i].trim().replace(/^[-•*]\s+/, "")));
        i++;
      }
      out.push(`<ul style="margin:8px 0;padding-left:20px">${items.map((it) => `<li style="margin:4px 0;line-height:1.65">${it}</li>`).join("")}</ul>`);
      continue;
    }

    if (/^\d+\.\s/.test(t) && /^\d+\.\s/.test(lines[i + 1]?.trim() ?? "")) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(b(lines[i].trim().replace(/^\d+\.\s+/, "")));
        i++;
      }
      out.push(`<ol style="margin:8px 0;padding-left:20px">${items.map((it) => `<li style="margin:4px 0;line-height:1.65">${it}</li>`).join("")}</ol>`);
      continue;
    }

    const para: string[] = [];
    while (i < lines.length) {
      const l = lines[i].trim();
      if (!l || l.startsWith("|") || /^#{1,3}\s/.test(l) || /^[-•*]\s/.test(l) ||
        /^(\d+\.\s+)?[A-Z][A-Z\s\d&./:(),-]{2,79}$/.test(l)) break;
      para.push(b(l));
      i++;
    }
    if (para.length) out.push(`<p style="margin:0 0 10px;line-height:1.7">${para.join(" ")}</p>`);
  }
  return out.join("\n");
}
