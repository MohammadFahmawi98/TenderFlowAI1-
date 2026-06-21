"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

interface Message { role: "user" | "assistant"; content: string; }

const SUGGESTIONS = [
  "What is the scope of work for this tender?",
  "What are the key compliance requirements?",
  "Summarise the staffing and manpower needs",
  "What is the estimated contract value from the BOQ?",
  "What are the top 3 risks for this bid?",
  "What evaluation criteria will the client use?",
  "Draft a one-paragraph executive summary",
  "What SLA KPIs are specified in the RFP?",
];

// ── Minimal markdown renderer (no deps) ──────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;

  function inlineFormat(s: string, key: number | string): React.ReactNode {
    // Bold **text**, italic *text*, inline `code`
    const parts: React.ReactNode[] = [];
    const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let idx = 0;
    while ((m = re.exec(s)) !== null) {
      if (m.index > last) parts.push(<span key={`t${idx++}`}>{s.slice(last, m.index)}</span>);
      if (m[2]) parts.push(<strong key={`b${idx++}`} className="font-semibold">{m[2]}</strong>);
      else if (m[3]) parts.push(<em key={`i${idx++}`}>{m[3]}</em>);
      else if (m[4]) parts.push(<code key={`c${idx++}`} className="rounded bg-white/[0.08] px-1 py-0.5 font-mono text-[12px] text-ai">{m[4]}</code>);
      last = m.index + m[0].length;
    }
    if (last < s.length) parts.push(<span key={`t${idx}`}>{s.slice(last)}</span>);
    return parts.length === 1 ? parts[0] : <span key={key}>{parts}</span>;
  }

  while (i < lines.length) {
    const line = lines[i];

    // Heading
    const hm = line.match(/^(#{1,3})\s+(.+)/);
    if (hm) {
      const level = hm[1].length;
      const cls = level === 1 ? "text-[15px] font-bold text-text mt-3 mb-1"
                : level === 2 ? "text-[13.5px] font-semibold text-text mt-2.5 mb-1"
                :               "text-[12.5px] font-semibold text-text-secondary mt-2 mb-0.5";
      nodes.push(<p key={i} className={cls}>{hm[2]}</p>);
      i++;
      continue;
    }

    // Bullet list — collect consecutive bullet lines
    if (/^[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s/, ""));
        i++;
      }
      nodes.push(
        <ul key={`ul${i}`} className="my-1.5 space-y-1 ps-4">
          {items.map((it, j) => (
            <li key={j} className="flex items-start gap-2 text-[13px]">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ai/70" />
              <span>{inlineFormat(it, j)}</span>
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      let num = 1;
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      nodes.push(
        <ol key={`ol${i}`} className="my-1.5 space-y-1 ps-4 list-none">
          {items.map((it, j) => (
            <li key={j} className="flex items-start gap-2 text-[13px]">
              <span className="mt-0 text-[11px] font-bold text-ai/70 min-w-[14px]">{j + num}.</span>
              <span>{inlineFormat(it, j)}</span>
            </li>
          ))}
        </ol>,
      );
      num += items.length;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      nodes.push(<hr key={i} className="my-2 border-border-light" />);
      i++;
      continue;
    }

    // Table rows (|col|col|)
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      const tableRows: string[][] = [];
      let isHeader = true;
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const row = lines[i].split("|").map((c) => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
        if (/^[-:| ]+$/.test(lines[i])) { i++; continue; } // separator row
        tableRows.push(row);
        i++;
      }
      if (tableRows.length > 0) {
        const [header, ...body] = tableRows;
        nodes.push(
          <div key={`tbl${i}`} className="my-2 overflow-x-auto rounded-lg border border-border-light">
            <table className="w-full text-[12px]">
              <thead className="bg-surface-mid">
                <tr>{header.map((h, j) => <th key={j} className="px-3 py-2 text-start font-semibold text-text-secondary">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {body.map((row, ri) => (
                  <tr key={ri} className="hover:bg-surface-dim/50">
                    {row.map((cell, ci) => <td key={ci} className="px-3 py-2 text-text">{inlineFormat(cell, ci)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );
      }
      continue;
    }

    // Blank line
    if (!line.trim()) {
      nodes.push(<div key={`sp${i}`} className="h-1" />);
      i++;
      continue;
    }

    // Paragraph
    nodes.push(
      <p key={i} className="text-[13.5px] leading-[1.7]">{inlineFormat(line, i)}</p>,
    );
    i++;
  }

  return nodes;
}

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-text-muted hover:text-text hover:bg-white/[0.06] transition-colors"
      title="Copy response"
    >
      <span className="material-symbols-outlined text-[13px]">{copied ? "check" : "content_copy"}</span>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return;
    setInput("");
    const history = messages;
    setMessages((m) => [...m, { role: "user", content: text }]);
    setStreaming(true);

    // Append empty assistant message that we'll fill in
    setMessages((m) => [...m, { role: "assistant", content: "" }]);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch(`/api/tenders/${id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: "Sorry, I encountered an error. Please try again." };
          return copy;
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        const snap = accumulated;
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: snap };
          return copy;
        });
        // Auto-scroll while streaming
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: "Connection error. Please try again." };
          return copy;
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [id, messages, streaming]);

  function clear() {
    abortRef.current?.abort();
    setMessages([]);
    setStreaming(false);
  }

  return (
    <div className="flex flex-col gap-0" style={{ height: "calc(100vh - 220px)" }}>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[22px] font-semibold text-text">Tender AI Chat</h2>
        {messages.length > 0 && (
          <button
            onClick={clear}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] text-text-secondary hover:text-text hover:border-border-mid transition-colors"
          >
            <span className="material-symbols-outlined text-[14px]">delete_sweep</span>
            Clear chat
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-card p-5">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border-light bg-surface shadow-sm">
              <span className="material-symbols-outlined text-[26px] text-ai">smart_toy</span>
            </div>
            <div>
              <p className="text-[16px] font-semibold text-text">Ask AI about this tender</p>
              <p className="mt-1 text-[13px] text-text-secondary">
                Answers are grounded in your uploaded RFP and AI-generated bid sections.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 max-w-lg">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-border px-4 py-2 text-[12.5px] text-text-secondary hover:border-ai/40 hover:text-text transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className={`mb-4 flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "assistant" ? (
                  <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white/[0.04] px-4 py-3">
                    <div className="mb-2 flex items-center justify-between gap-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-ai">TenderFlow AI</p>
                      {m.content && <CopyBtn text={m.content} />}
                    </div>
                    <div className="text-text">
                      {m.content
                        ? renderMarkdown(m.content)
                        : (
                          // Streaming dots while content is empty
                          <div className="flex gap-1">
                            {[0, 1, 2].map((j) => (
                              <motion.span
                                key={j}
                                className="h-2 w-2 rounded-full bg-ai"
                                animate={{ y: [0, -6, 0] }}
                                transition={{ repeat: Infinity, duration: 0.6, delay: j * 0.15 }}
                              />
                            ))}
                          </div>
                        )}
                    </div>
                  </div>
                ) : (
                  <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-brand/15 px-4 py-3 text-[13.5px] leading-relaxed text-text">
                    {m.content}
                  </div>
                )}
              </motion.div>
            ))}
            <div ref={bottomRef} />
          </AnimatePresence>
        )}
      </div>

      {/* Input row */}
      <div className="mt-3 flex gap-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send(input)}
          placeholder="Ask about this tender…"
          disabled={streaming}
          className="flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-[14px] text-text placeholder:text-text-secondary focus:border-brand/50 focus:outline-none disabled:opacity-50"
        />
        {streaming ? (
          <button
            onClick={() => abortRef.current?.abort()}
            className="rounded-xl border border-border bg-surface px-5 py-3 text-[13px] font-semibold text-text-secondary hover:text-text transition-colors"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={() => send(input)}
            disabled={!input.trim()}
            className="rounded-xl bg-brand px-5 py-3 text-[13px] font-semibold text-background hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            Send
          </button>
        )}
      </div>
    </div>
  );
}
