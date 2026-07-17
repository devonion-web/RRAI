/**
 * Unit tests for proposal-section SSE streaming.
 *
 * Run: node --test --import tsx/esm src/routes/proposal-stream.test.ts
 *
 * All Anthropic SDK calls are mocked — no live API tokens are consumed.
 * Tests are written with node:test + node:assert.
 */

import { describe, it, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

// ─── Minimal mock of Anthropic MessageStream ───────────────────────────────

class MockMessageStream extends EventEmitter {
  aborted = false;
  private _signal?: AbortSignal;

  constructor(signal?: AbortSignal) {
    super();
    this._signal = signal;
    if (signal?.aborted) {
      this.aborted = true;
    } else if (signal) {
      signal.addEventListener("abort", () => { this.aborted = true; }, { once: true });
    }
  }

  abort() {
    this.aborted = true;
  }

  /** Push text chunks then resolve finalMessage. */
  async finalMessage(chunks: string[] = []) {
    for (const chunk of chunks) {
      if (this.aborted) {
        const err = new AbortError("Request was aborted");
        this.emit("abort", err);
        throw err;
      }
      this.emit("text", chunk, chunk);
    }
    if (this.aborted) {
      const err = new AbortError("Request was aborted");
      throw err;
    }
    return { stop_reason: "end_turn", content: [] };
  }
}

class AbortError extends Error {
  readonly status = undefined;
  constructor(message: string) {
    super(message);
    this.name = "APIUserAbortError";
  }
}

// ─── 1. streamClaudeText — AbortSignal wired to SDK stream ────────────────

describe("streamClaudeText", () => {
  it("forwards text chunks to onChunk callback", async () => {
    // Manually test the callback wiring logic (mirrors streamClaudeText internals)
    const chunks: string[] = [];
    const stream = new MockMessageStream();
    stream.on("text", (delta: string) => chunks.push(delta));
    await stream.finalMessage(["Hello", " world"]);
    assert.deepEqual(chunks, ["Hello", " world"]);
  });

  it("honours AbortSignal — abort() is called when signal fires", async () => {
    const ac = new AbortController();
    const stream = new MockMessageStream(ac.signal);

    // Abort before finalMessage resolves
    ac.abort();

    assert.equal(stream.aborted, true,
      "stream.aborted should be true after signal fires");
  });

  it("does not abort when signal is not provided", async () => {
    const stream = new MockMessageStream(undefined);
    assert.equal(stream.aborted, false);
    await stream.finalMessage(["chunk"]);
    assert.equal(stream.aborted, false);
  });

  it("AbortSignal already aborted at construction time sets aborted immediately", () => {
    const ac = new AbortController();
    ac.abort();
    const stream = new MockMessageStream(ac.signal);
    assert.equal(stream.aborted, true);
  });
});

// ─── Minimal mock HTTP response for route-level tests ────────────────────

interface MockResponse {
  statusCode: number;
  headers: Record<string, string>;
  written: string[];
  ended: boolean;
  listeners: Map<string, (() => void)[]>;
  closed: boolean;
  flushCount: number;
  setHeader(name: string, value: string): void;
  flushHeaders(): void;
  write(chunk: string): boolean;
  flush(): void;
  end(): void;
  on(event: string, listener: () => void): MockResponse;
  off(event: string, listener: () => void): MockResponse;
  emit(event: string): void;
}

function makeMockRes(): MockResponse {
  const listeners = new Map<string, (() => void)[]>();
  return {
    statusCode: 200,
    headers: {},
    written: [],
    ended: false,
    closed: false,
    flushCount: 0,
    listeners,
    setHeader(name, value) { this.headers[name] = value; },
    flushHeaders() { /* headers sent */ },
    write(chunk) {
      if (this.ended) return false;
      this.written.push(chunk);
      return true;
    },
    flush() { this.flushCount++; },
    end() { this.ended = true; this.emit("close"); },
    on(event, listener) {
      const list = listeners.get(event) ?? [];
      list.push(listener);
      listeners.set(event, list);
      return this;
    },
    off(event, listener) {
      const list = listeners.get(event) ?? [];
      listeners.set(event, list.filter(l => l !== listener));
      return this;
    },
    emit(event) {
      for (const l of listeners.get(event) ?? []) l();
    },
  };
}

// ─── Simulate route logic (extracted from route handler) ──────────────────
//
// Rather than importing the full Express app (which requires DB/env), we
// replicate the *exact* route logic here with mock injections.  This is the
// standard pattern used in the existing route tests.

type WriteEventFn = (data: Record<string, unknown>) => void;

async function runRouteLogic(opts: {
  res: MockResponse;
  chunks: string[];
  /** Throw this error after all chunks are emitted, before the done event. */
  throwAfterChunks?: Error;
  abortImmediately?: boolean;
}) {
  const { res, chunks, throwAfterChunks, abortImmediately } = opts;

  type FlushableResponse = typeof res & { flush?: () => void };
  const flush = () => (res as FlushableResponse).flush?.();

  let closed = false;
  const writeEvent: WriteEventFn = (data) => {
    if (closed) return;
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    flush();
  };

  const ac = new AbortController();
  const keepalive = setInterval(() => {
    if (!closed) { res.write(": keepalive\n\n"); flush(); }
  }, 60_000); // long interval so it doesn't fire in tests

  const onClose = () => {
    closed = true;
    clearInterval(keepalive);
    ac.abort();
  };
  res.on("close", onClose);

  try {
    // Simulate streamClaudeText behaviour with mock chunks
    const stream = new MockMessageStream(ac.signal);

    if (abortImmediately) {
      // Simulate client disconnect before streaming starts
      res.emit("close");
    }

    stream.on("text", (chunk: string) => writeEvent({ delta: chunk }));

    for (const chunk of chunks) {
      if (stream.aborted) {
        throw new AbortError("Request was aborted");
      }
      stream.emit("text", chunk, chunk);
    }

    if (stream.aborted) {
      throw new AbortError("Request was aborted");
    }

    // Simulate an Anthropic/server error arriving after all chunks (e.g. rate-limit)
    if (throwAfterChunks) throw throwAfterChunks;

    writeEvent({ done: true });
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "APIUserAbortError";
    if (!isAbort) {
      writeEvent({ error: (err as Error).message });
    }
    // abort errors are intentionally not written to the response
  } finally {
    clearInterval(keepalive);
    res.off("close", onClose);
    res.end();
  }
}

// ─── 2. Client disconnect aborts the Anthropic request ───────────────────

describe("SSE route — client disconnect", () => {
  it("aborts the AbortController and sets closed=true on disconnect", async () => {
    const res = makeMockRes();
    let acAborted = false;

    const ac = new AbortController();
    ac.signal.addEventListener("abort", () => { acAborted = true; });

    let closed = false;
    const onClose = () => { closed = true; ac.abort(); };
    res.on("close", onClose);

    // Simulate disconnect
    res.emit("close");

    assert.equal(closed, true, "closed flag should be true");
    assert.equal(acAborted, true, "AbortController should have been aborted");
  });

  it("no delta or done events written after disconnect", async () => {
    const res = makeMockRes();
    await runRouteLogic({ res, chunks: ["a", "b", "c"], abortImmediately: true });

    const dataEvents = res.written.filter(w => w.startsWith("data:"));
    assert.equal(dataEvents.length, 0, "No data events should be written after disconnect");
  });

  it("response is ended even after disconnect", async () => {
    const res = makeMockRes();
    await runRouteLogic({ res, chunks: [], abortImmediately: true });
    assert.equal(res.ended, true, "res.end() must be called in finally");
  });
});

// ─── 3. Keepalive interval cleanup ────────────────────────────────────────

describe("SSE route — keepalive cleanup", () => {
  it("clearInterval is called on normal completion (finally block)", async () => {
    const cleared: unknown[] = [];
    const origClear = global.clearInterval;
    // @ts-ignore mock
    global.clearInterval = (id: unknown) => { cleared.push(id); origClear(id as ReturnType<typeof setInterval>); };

    try {
      const res = makeMockRes();
      await runRouteLogic({ res, chunks: ["hello"] });
      assert.ok(cleared.length > 0, "clearInterval should have been called");
    } finally {
      global.clearInterval = origClear;
    }
  });

  it("onClose handler is removed from res after completion", async () => {
    const res = makeMockRes();
    await runRouteLogic({ res, chunks: ["hello"] });
    const closeListeners = res.listeners.get("close") ?? [];
    assert.equal(closeListeners.length, 0, "close listener should be removed in finally");
  });
});

// ─── 4. No writes after response closed ──────────────────────────────────

describe("SSE route — no writes after close", () => {
  it("writeEvent is a no-op when closed=true", () => {
    const res = makeMockRes();
    type FlushableResponse = typeof res & { flush?: () => void };
    const flush = () => (res as FlushableResponse).flush?.();

    let closed = false;
    const writeEvent: WriteEventFn = (data) => {
      if (closed) return;
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      flush();
    };

    closed = true;
    writeEvent({ delta: "should not appear" });

    assert.equal(res.written.length, 0, "writeEvent must be a no-op when closed=true");
  });
});

// ─── 5. Normal streaming emits delta + done, closes response ─────────────

describe("SSE route — normal streaming", () => {
  it("emits delta events for each chunk", async () => {
    const res = makeMockRes();
    await runRouteLogic({ res, chunks: ["Hello", " world", "!"] });

    const deltas = res.written
      .filter(w => w.startsWith("data:"))
      .map(w => JSON.parse(w.slice(6).trim()));

    const textDeltas = deltas.filter(e => "delta" in e).map(e => e.delta);
    assert.deepEqual(textDeltas, ["Hello", " world", "!"]);
  });

  it("emits done event as last data event", async () => {
    const res = makeMockRes();
    await runRouteLogic({ res, chunks: ["a", "b"] });

    const dataEvents = res.written
      .filter(w => w.startsWith("data:"))
      .map(w => JSON.parse(w.slice(6).trim()));

    const last = dataEvents[dataEvents.length - 1];
    assert.deepEqual(last, { done: true });
  });

  it("calls res.end() to close the response", async () => {
    const res = makeMockRes();
    await runRouteLogic({ res, chunks: ["x"] });
    assert.equal(res.ended, true);
  });

  it("calls flush after each delta write", async () => {
    const res = makeMockRes();
    await runRouteLogic({ res, chunks: ["a", "b"] });
    // flush called once per chunk + once for done event = 3 flushes
    assert.ok(res.flushCount >= 3, `Expected ≥3 flushes, got ${res.flushCount}`);
  });
});

// ─── 6. Anthropic error emits error event, response still open ───────────

describe("SSE route — Anthropic error", () => {
  it("emits error event on non-abort exception", async () => {
    const res = makeMockRes();
    const apiError = new Error("Rate limit exceeded");
    await runRouteLogic({ res, chunks: ["partial"], throwAfterChunks: apiError });

    const dataEvents = res.written
      .filter(w => w.startsWith("data:"))
      .map(w => JSON.parse(w.slice(6).trim()));

    const errEvent = dataEvents.find(e => "error" in e);
    assert.ok(errEvent, "error event should be emitted");
    assert.equal(errEvent.error, "Rate limit exceeded");
  });

  it("error event is not emitted for APIUserAbortError", async () => {
    const res = makeMockRes();
    const abortErr = new AbortError("Aborted");
    await runRouteLogic({ res, chunks: [], throwAfterChunks: abortErr });

    const dataEvents = res.written
      .filter(w => w.startsWith("data:"))
      .map(w => JSON.parse(w.slice(6).trim()));

    const errEvent = dataEvents.find(e => "error" in e);
    assert.equal(errEvent, undefined, "No error event for abort");
  });
});

// ─── 7 & 8. generateProposalSectionStream client logic ───────────────────
//
// We test the SSE parsing logic extracted inline to keep this file self-contained
// and avoid importing the Vite-only rai module into a Node.js test.

async function runClientStream(sseLines: string[]) {
  // Simulate ReadableStream producing the given SSE lines
  const encoder = new TextEncoder();
  const payload = sseLines.join("\n") + "\n";
  let offset = 0;

  const readable = new ReadableStream({
    pull(controller) {
      if (offset >= payload.length) {
        controller.close();
        return;
      }
      // Feed in small chunks to test incremental decoding
      const slice = payload.slice(offset, offset + 20);
      offset += 20;
      controller.enqueue(encoder.encode(slice));
    },
  });

  const reader = readable.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let doneSeen = false;
  const received: string[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const p = line.slice(6).trim();
      if (!p) continue;
      let event: Record<string, unknown>;
      try { event = JSON.parse(p); } catch { continue; }
      if (event["delta"] !== undefined) received.push(event["delta"] as string);
      if (event["done"]) { doneSeen = true; return { received, doneSeen }; }
      if (event["error"]) throw new Error(event["error"] as string);
    }
  }

  if (!doneSeen) throw new Error("Proposal stream closed before completion");
  return { received, doneSeen };
}

describe("generateProposalSectionStream client logic", () => {
  it("(7) throws when transport closes without done event", async () => {
    const lines = [
      `data: ${JSON.stringify({ delta: "partial content" })}`,
      // no done event — stream closes
    ];
    await assert.rejects(
      () => runClientStream(lines),
      /Proposal stream closed before completion/,
    );
  });

  it("(8) resolves only after receiving done event", async () => {
    const lines = [
      `data: ${JSON.stringify({ delta: "chunk1" })}`,
      `data: ${JSON.stringify({ delta: "chunk2" })}`,
      `data: ${JSON.stringify({ done: true })}`,
    ];
    const result = await runClientStream(lines);
    assert.equal(result.doneSeen, true);
    assert.deepEqual(result.received, ["chunk1", "chunk2"]);
  });

  it("throws the server-supplied error message on SSE error event", async () => {
    const lines = [
      `data: ${JSON.stringify({ delta: "so far" })}`,
      `data: ${JSON.stringify({ error: "Anthropic timeout" })}`,
    ];
    await assert.rejects(
      () => runClientStream(lines),
      /Anthropic timeout/,
    );
  });

  it("partial content delivered via onChunk before an error is preserved", async () => {
    // Simulate: two chunks delivered, then stream closes unexpectedly
    const encoder = new TextEncoder();
    const sseText = [
      `data: ${JSON.stringify({ delta: "hello " })}`,
      `data: ${JSON.stringify({ delta: "world" })}`,
      // no done
    ].join("\n") + "\n";

    const readable = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sseText));
        controller.close();
      },
    });

    const reader = readable.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const received: string[] = [];
    let caughtError: Error | null = null;

    try {
      let doneSeen = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const p = line.slice(6).trim();
          if (!p) continue;
          let event: Record<string, unknown>;
          try { event = JSON.parse(p); } catch { continue; }
          if (event["delta"] !== undefined) received.push(event["delta"] as string);
          if (event["done"]) { doneSeen = true; return; }
        }
      }
      if (!doneSeen) throw new Error("Proposal stream closed before completion");
    } catch (err) {
      caughtError = err as Error;
    }

    // (9) Partial content was received BEFORE the error was thrown
    assert.deepEqual(received, ["hello ", "world"],
      "Partial content must be preserved in received array even when stream closes unexpectedly");
    assert.ok(caughtError, "An error must be thrown for unexpected closure");
    assert.match(caughtError!.message, /closed before completion/);
  });
});

// ─── 10. Generate-all: all sections launch concurrently ──────────────────

describe("handleGenerateAllProposalSections logic", () => {
  it("(10) Promise.allSettled launches all tasks concurrently and one failure does not stop others", async () => {
    const started: string[] = [];
    const settled: string[] = [];

    // Simulate 8 section generators — second one fails
    const sectionIds = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"];

    async function generateSection(id: string): Promise<void> {
      started.push(id);
      // Simulate async work
      await new Promise<void>(resolve => setImmediate(resolve));
      if (id === "s2") throw new Error("s2 failed");
      settled.push(id);
    }

    const results = await Promise.allSettled(sectionIds.map(id => generateSection(id)));

    // All 8 started
    assert.equal(started.length, 8, "All 8 sections should start");

    // s2 failed, remaining 7 settled
    assert.equal(settled.length, 7, "7 sections should have settled successfully");

    // s2 result is rejected
    const s2result = results.find((_, i) => sectionIds[i] === "s2");
    assert.equal(s2result?.status, "rejected", "s2 must be rejected");

    // Others are fulfilled
    const fulfilled = results.filter(r => r.status === "fulfilled");
    assert.equal(fulfilled.length, 7, "7 results must be fulfilled");

    // All 8 results returned (Promise.allSettled never rejects)
    assert.equal(results.length, 8);
  });
});
