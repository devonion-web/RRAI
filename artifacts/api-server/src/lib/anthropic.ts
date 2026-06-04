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

export async function callClaude(system: string, user: string): Promise<string> {
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system,
    messages: [{ role: "user", content: user }],
  });
  const block = msg.content[0];
  return block.type === "text" ? block.text : "";
}

export async function callClaudeJSON<T>(system: string, user: string): Promise<T> {
  const raw = await callClaude(system, user);
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
