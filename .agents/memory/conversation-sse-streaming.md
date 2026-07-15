---
name: Conversation SSE streaming
description: The send-and-stream pipeline for the /conversations/:id/messages endpoint — order of operations, SSE event shapes, context-window strategy, and error handling rules.
---

## Pipeline (correct order — do not reorder)
1. Validate actor + conversation access (`getConversation` enforces org scope)
2. Persist user message (`status: complete`) — durability before SSE opens
3. Set SSE response headers + flush
4. Start keepalive interval (15 s `: keepalive` pings)
5. Create pending assistant message in DB
6. Emit `{"pending":true,"messageId":"<id>"}` SSE event
7. Call `anthropic.messages.stream()`
8. On each text delta: emit `{"delta":"<text>"}` and accumulate `fullContent`
9. On stream end: call `finaliseMessage(id, fullContent, metadata)` → status: complete
10. Emit `{"done":true,"messageId":"<id>"}`, call `res.end()`
11. On error: call `markMessageFailed(id, safeErrorMeta)`, emit `{"error":"<generic>"}`, call `res.end()`

**Why this order:** User message is persisted _before_ SSE headers open so that a proxy timeout or client disconnect cannot leave the user message unpersisted. The assistant message starts as `pending` so a page refresh mid-stream finds a durable row.

## Context-window strategy (v1)
- Character budget: 60,000 chars (~15k tokens at 4 chars/token)
- Walk history backwards from newest; accumulate until budget exhausted
- Always include current user message
- Always include system prompt (not counted in char budget)
- Exclude `failed` and `system` messages from model context
- Opportunity summary prepended to system prompt (not to messages array)
- No automatic summarisation; schema supports future `summaryId` column

## Lens tone
Each `ConversationLens` has a tone instruction injected via system prompt.
`commercial` lens is the only lens that may include pricing/commercial context.
`analyst` lens explicitly excludes commercial fields — enforced by tone text, not yet by data filtering.

## Error safety
- Never expose raw Anthropic API errors to the client — generic message only
- Error metadata stored in `messages.metadata` (JSONB) for internal diagnosis
- `failedAt` ISO timestamp always included in failure metadata
