import assert from "node:assert/strict";
import test from "node:test";
import {
  formatRemainingTime,
} from "../../src/features/uploads/model/uploadCenter.ts";

test("remaining time is displayed readably", () => {
  assert.equal(formatRemainingTime(null), "Calculating…");
  assert.equal(formatRemainingTime(12.2), "13 s remaining");
  assert.equal(formatRemainingTime(121), "3 min remaining");
  assert.equal(formatRemainingTime(3660), "1 h 1 min remaining");
});
