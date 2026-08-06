import assert from "node:assert/strict";
import test from "node:test";
import { createInfraiClient } from "../src/infrai.js";

test("retries a rate-limited presign and reads the successful envelope", async () => {
  const requests: Array<{ input: string; init?: RequestInit }> = [];
  const waits: number[] = [];
  const responses = [
    new Response(JSON.stringify({ ok: false, error: { message: "Please retry" } }), {
      status: 429,
      headers: { "Retry-After": "2", "Content-Type": "application/json" },
    }),
    new Response(JSON.stringify({ ok: true, data: { url: "https://download.example/signed" } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  ];

  const fakeFetch = async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({ input: String(input), init });
    const response = responses.shift();
    assert.ok(response);
    return response;
  };

  const infrai = createInfraiClient(
    "test-key",
    fakeFetch as typeof fetch,
    async (milliseconds) => {
      waits.push(milliseconds);
    },
  );

  const result = await infrai.storage.object.presign("records", "visit.pdf", {
    op: "get",
    expires_seconds: 300,
    idempotency_key: "request-123",
  });

  assert.equal(result.url, "https://download.example/signed");
  assert.deepEqual(waits, [2_000]);
  assert.equal(requests.length, 2);
  assert.equal(requests[0]?.init?.method, "POST");
  assert.equal(requests[0]?.init?.headers instanceof Headers, false);
});

test("surfaces an API envelope error", async () => {
  const fakeFetch = async () =>
    new Response(JSON.stringify({ ok: false, error: { message: "Invalid request" } }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  const infrai = createInfraiClient("test-key", fakeFetch as typeof fetch);

  await assert.rejects(
    infrai.storage.bucket.create("records"),
    /Invalid request/,
  );
});
