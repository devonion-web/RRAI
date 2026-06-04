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
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/m, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(`Claude returned invalid JSON. Raw response: ${raw.slice(0, 400)}`);
  }
}

/**
 * Stream a Claude generation while keeping the HTTP connection alive.
 * Collects the full streamed text, then returns it as a parsed JSON object.
 * Use for long-running generations that risk hitting the 120s proxy timeout.
 */
export async function callClaudeJSONStreamed<T>(
  system: string,
  user: string,
  res: import("express").Response,
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

  const cleaned = fullText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/m, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(`Claude returned invalid JSON. Raw response: ${fullText.slice(0, 400)}`);
  }
}
