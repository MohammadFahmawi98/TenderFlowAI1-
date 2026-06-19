"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface DocumentEditorProps {
  documentId: string;
  initialHtml?: string;
  reviewStatus?: string;
  onSave?: (html: string) => void;
}

const AI_ACTIONS = [
  { key: "rewrite",     label: "Rewrite" },
  { key: "expand",      label: "Expand" },
  { key: "shorten",     label: "Shorten" },
  { key: "professional", label: "Make Professional" },
  { key: "technical",   label: "Make Technical" },
  { key: "translate_ar", label: "Translate to Arabic" },
];

const REVIEW_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft:             { label: "Draft",             color: "text-text-secondary bg-white/5" },
  ai_generated:      { label: "AI Generated",      color: "text-[#00E5FF] bg-[#00E5FF]/10" },
  in_review:         { label: "In Review",          color: "text-[#F59E0B] bg-[#F59E0B]/10" },
  changes_requested: { label: "Changes Requested",  color: "text-[#EF4444] bg-[#EF4444]/10" },
  approved:          { label: "Approved",           color: "text-[#10B981] bg-[#10B981]/10" },
  final:             { label: "Final",              color: "text-brand bg-brand/10" },
};

export function DocumentEditor({
  documentId,
  initialHtml = "",
  reviewStatus = "ai_generated",
  onSave,
}: DocumentEditorProps) {
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [status, setStatus] = useState(reviewStatus);
  const [showAiMenu, setShowAiMenu] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: "Start writing or let AI generate content…" }),
    ],
    content: initialHtml || "<p></p>",
    editorProps: {
      attributes: {
        class:
          "prose prose-invert max-w-none min-h-[400px] outline-none text-[15px] leading-relaxed text-text",
      },
    },
  });

  const save = useCallback(async () => {
    if (!editor) return;
    setSaving(true);
    try {
      const html = editor.getHTML();
      await fetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content_html: html, review_status: status }),
      });
      onSave?.(html);
      setSavedMsg("Saved");
      setTimeout(() => setSavedMsg(""), 2000);
    } finally {
      setSaving(false);
    }
  }, [editor, documentId, status, onSave]);

  const runAiAction = useCallback(async (action: string) => {
    if (!editor) return;
    const { from, to, empty } = editor.state.selection;
    const selectedText = empty
      ? editor.getText()
      : editor.state.doc.textBetween(from, to);

    if (!selectedText.trim()) return;
    setAiLoading(true);
    setShowAiMenu(false);
    try {
      const res = await fetch(`/api/documents/${documentId}/ai-rewrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: selectedText, action }),
      });
      const { result } = await res.json();
      if (result) {
        if (empty) {
          editor.commands.setContent(`<p>${result.replace(/\n/g, "</p><p>")}</p>`);
        } else {
          editor.commands.insertContentAt({ from, to }, result);
        }
      }
    } finally {
      setAiLoading(false);
    }
  }, [editor, documentId]);

  const statusInfo = REVIEW_STATUS_LABELS[status] ?? REVIEW_STATUS_LABELS.draft;

  return (
    <div className="flex flex-col gap-0 rounded-xl border border-border bg-card overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2 flex-wrap">
        {/* Text formatting */}
        {[
          { cmd: () => editor?.chain().focus().toggleBold().run(), label: "B", active: editor?.isActive("bold"), style: "font-bold" },
          { cmd: () => editor?.chain().focus().toggleItalic().run(), label: "I", active: editor?.isActive("italic"), style: "italic" },
          { cmd: () => editor?.chain().focus().toggleUnderline().run(), label: "U", active: editor?.isActive("underline"), style: "underline" },
        ].map((btn) => (
          <button
            key={btn.label}
            onClick={btn.cmd}
            className={`px-2.5 py-1 rounded text-[13px] ${btn.style} transition-colors ${btn.active ? "bg-brand/20 text-brand" : "text-text-secondary hover:text-text hover:bg-white/5"}`}
          >
            {btn.label}
          </button>
        ))}

        <div className="h-4 w-px bg-border mx-1" />

        {/* Headings */}
        {[1, 2, 3].map((level) => (
          <button
            key={level}
            onClick={() => editor?.chain().focus().toggleHeading({ level: level as 1|2|3 }).run()}
            className={`px-2 py-1 rounded text-[12px] font-medium transition-colors ${editor?.isActive("heading", { level }) ? "bg-brand/20 text-brand" : "text-text-secondary hover:text-text hover:bg-white/5"}`}
          >
            H{level}
          </button>
        ))}

        <div className="h-4 w-px bg-border mx-1" />

        {/* Lists */}
        <button
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          className={`px-2 py-1 rounded text-[12px] transition-colors ${editor?.isActive("bulletList") ? "bg-brand/20 text-brand" : "text-text-secondary hover:text-text hover:bg-white/5"}`}
        >
          • List
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          className={`px-2 py-1 rounded text-[12px] transition-colors ${editor?.isActive("orderedList") ? "bg-brand/20 text-brand" : "text-text-secondary hover:text-text hover:bg-white/5"}`}
        >
          1. List
        </button>

        <div className="flex-1" />

        {/* AI Actions */}
        <div className="relative">
          <button
            onClick={() => setShowAiMenu((v) => !v)}
            disabled={aiLoading}
            className="flex items-center gap-1.5 rounded-lg border border-ai/30 bg-ai/10 px-3 py-1.5 text-[12px] font-medium text-ai hover:bg-ai/20 transition-colors disabled:opacity-50"
          >
            {aiLoading ? (
              <span className="h-3 w-3 animate-spin rounded-full border border-ai border-t-transparent" />
            ) : (
              <span className="text-[10px]">✦</span>
            )}
            AI Rewrite
          </button>

          <AnimatePresence>
            {showAiMenu && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.97 }}
                transition={{ duration: 0.12 }}
                className="absolute right-0 top-full mt-1 z-50 rounded-xl border border-border bg-surface shadow-xl min-w-[160px] overflow-hidden"
              >
                {AI_ACTIONS.map((a) => (
                  <button
                    key={a.key}
                    onClick={() => runAiAction(a.key)}
                    className="w-full px-4 py-2.5 text-left text-[13px] text-text-secondary hover:bg-white/5 hover:text-text transition-colors"
                  >
                    {a.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Status badge */}
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={`rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-wide border-0 outline-none cursor-pointer ${statusInfo.color} bg-transparent`}
        >
          {Object.entries(REVIEW_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k} className="bg-surface text-text normal-case tracking-normal">
              {v.label}
            </option>
          ))}
        </select>

        {/* Save */}
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-brand px-4 py-1.5 text-[12px] font-semibold text-background hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? "Saving…" : savedMsg || "Save"}
        </button>
      </div>

      {/* Editor body */}
      <div className="px-8 py-6">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
