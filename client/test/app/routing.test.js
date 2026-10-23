import assert from "node:assert/strict";
import test from "node:test";
import { resolvePublicRoute } from "../../src/app/routing.ts";

test("resolves public routes without affecting the dashboard", () => {
  assert.equal(resolvePublicRoute("/drive"), null);
  assert.deepEqual(resolvePublicRoute("/file-not-found"), {
    kind: "missing",
    value: "",
  });
  assert.deepEqual(resolvePublicRoute("/d/token-seguro"), {
    kind: "download",
    value: "token-seguro",
  });
});

test("decodes public paths and rejects invalid encoding", () => {
  assert.deepEqual(resolvePublicRoute("/public/My%20Folder/photo.jpg"), {
    kind: "public",
    value: "My Folder/photo.jpg",
  });
  assert.deepEqual(resolvePublicRoute("/public/%E0%A4%A"), {
    kind: "missing",
    value: "",
  });
});
