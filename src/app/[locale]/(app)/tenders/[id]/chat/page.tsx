"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

interface Message { role: "user" | "assistant"; content: string; }

const SUGGESTIONS = [
  "What are the key compliance requirements?",
  "Summarise the scope of work",
  "What is the submission deadline?",
  "What risks should we highlight?",
  "Generate an executive summary",
  "What staffing roles are required?",
];

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    setInput("");
    const userMsg: Message = { role: "user", content: text };
    const history = messages;
    setMessages((m) => [...m, userMsg]);
    setLoading(true);

    try {
      const res = await fetch(`/api/tenders/${id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      const data = await res.json();
      const reply = data.reply ?? data.error ?? "I couldn't process that. Please try again.";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "An error occurred. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-0" style={{ height: "calc(100vh - 220px)" }}>
      <h2 className="mb-4 text-[22px] font-semibold text-text">Tender Chat</h2>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-card p-6">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
            <div>
              <p className="text-[16px] font-semibold text-text">Ask AI about this tender</p>
              <p className="mt-1 text-[13px] text-text-secondary">Get instant answers grounded in your uploaded RFP and generated documents.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-border px-4 py-2 text-[13px] text-text-secondary hover:border-brand/50 hover:text-brand transition-colors"
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
                <div className={[
                  "max-w-[80%] rounded-2xl px-4 py-3 text-[14px] leading-relaxed",
                  m.role === "user"
                    ? "bg-brand/15 text-text"
                    : "bg-white/[0.04] text-text",
                ].join(" ")}>
                  {m.role === "assistant" && (
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ai">TenderFlow AI</p>
                  )}
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              </motion.div>
            ))}
            {loading && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start mb-4">
                <div className="rounded-2xl bg-white/[0.04] px-4 py-3">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="h-2 w-2 rounded-full bg-ai"
                        animate={{ y: [0, -6, 0] }}
                        transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.15 }}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
            <div ref={bottomRef} />
          </AnimatePresence>
        )}
      </div>

      {/* Input */}
      <div className="mt-3 flex gap-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send(input)}
          placeholder="Ask about this tender…"
          disabled={loading}
          className="flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-[14px] text-text placeholder:text-text-secondary focus:border-brand/50 focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
          className="rounded-xl bg-brand px-5 py-3 text-[13px] font-semibold text-background hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          Send
        </button>
      </div>
    </div>
  );
}
