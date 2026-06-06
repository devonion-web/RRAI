import Anthropic from "@anthropic-ai/sdk";
import { logger } from "./logger";

const baseURL = process.env["AI_INTEGRATIONS_ANTHROPIC_BASE_URL"];
const apiKey = process.env["AI_INTEGRATIONS_ANTHROPIC_API_KEY"];

if (!baseURL || !apiKey) {
  logger.warn("Anthropic AI integration env vars missing — AI routes will fail at runtime");
}

export const anthropic = new Anthropic({
  baseURL: baseURL ?? "https://api.anthropic.com",
  apiKey: apiKey ?? "missing",
});

const MODEL = "claude-sonnet-4-6";

export interface ClaudeOptions {
  maxTokens?: number;
}

/** Robustly parse Claude's JSON output — handles code fences, leading text, etc. */
function parseClaudeJSON<T>(raw: string): T {
  const trimmed = raw.trim();

  // 1. Direct parse — ideal path
  try { return JSON.parse(trimmed) as T; } catch {}

  // 2. Slice from first { to last } (skips code fences, trailing text)
  const objStart = trimmed.indexOf("{");
  const objEnd = trimmed.lastIndexOf("}");
  if (objStart !== -1 && objEnd > objStart) {
    try { return JSON.parse(trimmed.slice(objStart, objEnd + 1)) as T; } catch {}
  }

  // 3. Slice from first [ to last ] (JSON array)
  const arrStart = trimmed.indexOf("[");
  const arrEnd = trimmed.lastIndexOf("]");
  if (arrStart !== -1 && arrEnd > arrStart) {
    try { return JSON.parse(trimmed.slice(arrStart, arrEnd + 1)) as T; } catch {}
  }

  throw new Error(`Claude returned invalid JSON. Raw response: ${raw.slice(0, 400)}`);
}

export async function callClaude(system: string, user: string, opts: ClaudeOptions = {}): Promise<string> {
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 8192,
    system,
    messages: [{ role: "user", content: user }],
  });
  const block = msg.content[0];
  return block.type === "text" ? block.text : "";
}

export async function callClaudeJSON<T>(system: string, user: string, opts: ClaudeOptions = {}): Promise<T> {
  const raw = await callClaude(system, user, opts);
  return parseClaudeJSON<T>(raw);
}

/**
 * Stream a Claude generation while keeping the HTTP connection alive.
 * Collects the full streamed text, then returns it as a parsed JSON object.
 * Use for long-running generations that risk hitting the 120s proxy timeout.
 */
export async function callClaudeJSONStreamed<T>(
  system: string,
  user: string,
  _res: import("express").Response,
  opts: ClaudeOptions = {}
): Promise<T> {
  let fullText = "";

  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 4096,
    system,
    messages: [{ role: "user", content: user }],
  });

  stream.on("text", (chunk) => {
    fullText += chunk;
  });

  await stream.finalMessage();

  return parseClaudeJSON<T>(fullText);
}

/**
 * Stream a Claude generation and return the raw text.
 * Use when the response is plain prose/markdown, not JSON.
 * Keeps the HTTP connection alive for long generations.
 */
export async function callClaudeTextStreamed(
  system: string,
  user: string,
  _res: import("express").Response,
  opts: ClaudeOptions = {}
): Promise<string> {
  let fullText = "";

  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 4096,
    system,
    messages: [{ role: "user", content: user }],
  });

  stream.on("text", (chunk) => {
    fullText += chunk;
  });

  await stream.finalMessage();

  return fullText.trim();
}
