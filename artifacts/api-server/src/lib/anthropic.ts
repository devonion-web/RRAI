import Anthropic from "@anthropic-ai/sdk";
import { logger } from "./logger";

const baseURL = process.env["AI_INTEGRATIONS_ANTHROPIC_BASE_URL"];
const apiKey  = process.env["AI_INTEGRATIONS_ANTHROPIC_API_KEY"];

if (!baseURL || !apiKey) {
  logger.warn("Anthropic AI integration env vars missing — AI routes will fail at runtime");
}

export const anthropic = new Anthropic({
  baseURL: baseURL ?? "https://api.anthropic.com",
  apiKey:  apiKey  ?? "missing",
});

const MODEL = "claude-sonnet-4-6";

export interface ClaudeOptions {
  maxTokens?: number;
}

/** Strip ```json fences and pull out the outermost JSON object or array. */
function defensiveParse<T>(raw: string): T {
  const trimmed = raw.trim();

  // 1. Direct parse — ideal path
  try { return JSON.parse(trimmed) as T; } catch {}

  // 2. Strip code fences
  const stripped = trimmed.replace(/^```(?:json)?\s*/m, "").replace(/```\s*$/, "").trim();
  try { return JSON.parse(stripped) as T; } catch {}

  // 3. Extract outermost { ... }
  const ob = stripped.indexOf("{"), oe = stripped.lastIndexOf("}");
  if (ob !== -1 && oe > ob) {
    try { return JSON.parse(stripped.slice(ob, oe + 1)) as T; } catch {}
  }

  // 4. Extract outermost [ ... ]
  const ab = stripped.indexOf("["), ae = stripped.lastIndexOf("]");
  if (ab !== -1 && ae > ab) {
    try { return JSON.parse(stripped.slice(ab, ae + 1)) as T; } catch {}
  }

  throw new Error(`Claude returned unparseable JSON. Preview: ${raw.slice(0, 300)}`);
}

// ── Plain text ────────────────────────────────────────────────────────────────

export async function callClaude(
  system: string,
  user: string,
  opts: ClaudeOptions = {},
): Promise<string> {
  const maxTokens = opts.maxTokens ?? 8192;
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  if (msg.stop_reason === "max_tokens") {
    logger.warn({ maxTokens }, "callClaude: response truncated (stop_reason=max_tokens)");
  }
  const block = msg.content[0];
  return block.type === "text" ? block.text : "";
}

// ── Structured JSON via tool-forcing ─────────────────────────────────────────
//
// Tool-forcing makes Claude output JSON inside a tool_use block.
// The API guarantees the tool input is valid JSON — no code fences, no preamble.
// Falls back to defensive text parse if the proxy rejects tool_choice.

export async function callClaudeJSON<T>(
  system: string,
  user: string,
  opts: ClaudeOptions = {},
): Promise<T> {
  const maxTokens = opts.maxTokens ?? 8192;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
      tools: [
        {
          name: "json_response",
          description: "Return the complete structured JSON response as specified in the prompt",
          input_schema: {
            type: "object" as const,
            properties: {},
            additionalProperties: true,
          },
        },
      ],
      tool_choice: { type: "tool" as const, name: "json_response" },
    });

    if (response.stop_reason === "max_tokens") {
      throw new Error(
        `Claude response truncated — increase max_tokens (currently ${maxTokens}). ` +
        "The JSON is incomplete and cannot be parsed.",
      );
    }

    const toolBlock = response.content.find((b) => b.type === "tool_use");
    if (toolBlock?.type === "tool_use") {
      return toolBlock.input as T;
    }

    // Tool block absent — try text fallback
    const textBlock = response.content.find((b) => b.type === "text");
    if (textBlock?.type === "text") {
      return defensiveParse<T>(textBlock.text);
    }

    throw new Error("Claude returned no usable content block");
  } catch (err: unknown) {
    // If the proxy/model rejects tool_choice (400), fall back to plain text + defensive parse
    const isApiErr = err instanceof Anthropic.APIError;
    if (isApiErr && (err as Anthropic.APIError).status === 400) {
      logger.warn("callClaudeJSON: tool-forcing rejected (400), falling back to text parse");
      const raw = await callClaude(system, user, { maxTokens });
      return defensiveParse<T>(raw);
    }
    throw err;
  }
}

// ── Streamed helpers (text generation) ───────────────────────────────────────

export async function callClaudeJSONStreamed<T>(
  system: string,
  user: string,
  _res: import("express").Response,
  opts: ClaudeOptions = {},
): Promise<T> {
  let fullText = "";
  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 8192,
    system,
    messages: [{ role: "user", content: user }],
  });
  stream.on("text", (chunk) => { fullText += chunk; });
  const final = await stream.finalMessage();
  if (final.stop_reason === "max_tokens") {
    throw new Error("Claude response truncated (streamed) — increase max_tokens");
  }
  return defensiveParse<T>(fullText);
}

export async function callClaudeTextStreamed(
  system: string,
  user: string,
  _res: import("express").Response,
  opts: ClaudeOptions = {},
): Promise<string> {
  let fullText = "";
  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 8192,
    system,
    messages: [{ role: "user", content: user }],
  });
  stream.on("text", (chunk) => { fullText += chunk; });
  await stream.finalMessage();
  return fullText.trim();
}
