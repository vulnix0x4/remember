import assert from "node:assert/strict";
import test from "node:test";
import { authorizationHeaders, isSavableUrl, normalizeApiBase, saveImprint } from "../lib/api.mjs";

test("accepts web pages and rejects extension pages", () => {
  assert.equal(isSavableUrl("https://youtu.be/dQw4w9WgXcQ"), true);
  assert.equal(isSavableUrl("chrome://extensions"), false);
});

test("requires TLS away from loopback", () => {
  assert.equal(normalizeApiBase("http://localhost:8787/"), "http://localhost:8787");
  assert.throws(() => normalizeApiBase("http://example.com"), /HTTPS/);
});

test("uses an isolated dev identity locally and requires a token remotely", () => {
  assert.equal(authorizationHeaders("http://localhost:8787")["x-dev-user-id"], "00000000-0000-4000-8000-000000000001");
  assert.deepEqual(authorizationHeaders("https://remember.example", "secret"), { authorization: "Bearer secret" });
  assert.throws(() => authorizationHeaders("https://remember.example"), /access token/i);
});

test("posts the capture contract", async () => {
  let request;
  const result = await saveImprint(
    { apiBase: "https://remember.example", accessToken: "secret", url: "https://youtu.be/example", title: "Meaningful", reaction: "This mattered." },
    async (url, init) => {
      request = { url, init };
      return new Response(JSON.stringify({ item: { id: "item-1" } }), { status: 201, headers: { "content-type": "application/json" } });
    }
  );
  assert.equal(request.url, "https://remember.example/api/items");
  assert.equal(request.init.headers.authorization, "Bearer secret");
  assert.deepEqual(JSON.parse(request.init.body), {
    url: "https://youtu.be/example",
    title: "Meaningful",
    personalReaction: "This mattered."
  });
  assert.equal(result.item.id, "item-1");
});
