import OpenAI from "openai";

function clean(s: string | undefined): string {
  return (s ?? "").replace(/^﻿/, "").trim();
}

function getClient(): OpenAI {
  return new OpenAI({ apiKey: clean(process.env.OPENAI_API_KEY) });
}

export interface CompletionOptions {
  system: string;
  user: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "json" | "text";
}

export async function complete(opts: CompletionOptions): Promise<string> {
  const client = getClient();
  const resp = await client.chat.completions.create({
    model: opts.model ?? "gpt-4o",
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens ?? 4096,
    response_format:
      opts.responseFormat === "json" ? { type: "json_object" } : { type: "text" },
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
  });
  return resp.choices[0]?.message?.content ?? "";
}

export async function embed(text: string): Promise<number[]> {
  const client = getClient();
  const resp = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text.slice(0, 8192),
  });
  return resp.data[0].embedding;
}