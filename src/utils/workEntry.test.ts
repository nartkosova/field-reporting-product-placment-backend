import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseWorkEntry, REASON_MAX_LENGTH } from "./workEntry";

describe("parseWorkEntry", () => {
  it("treats a payload without entry_type as a market visit", () => {
    assert.deepEqual(parseWorkEntry({ store_id: 7 }), {
      value: { entry_type: "market", store_id: 7, reason: null },
    });
  });

  it("requires a valid store for a market entry", () => {
    for (const store_id of [undefined, null, "", "abc", 0, -1, 1.5]) {
      assert.ok("error" in parseWorkEntry({ entry_type: "market", store_id }), String(store_id));
    }
  });

  it("rejects a reason on a market entry", () => {
    assert.ok("error" in parseWorkEntry({ entry_type: "market", store_id: 1, reason: "x" }));
  });

  it("accepts an empty reason on a market entry", () => {
    assert.ok("value" in parseWorkEntry({ entry_type: "market", store_id: 1, reason: "  " }));
  });

  for (const entry_type of ["other_work", "private_work"]) {
    it(`does not need a store or a reason for ${entry_type}`, () => {
      assert.deepEqual(parseWorkEntry({ entry_type }), {
        value: { entry_type, store_id: null, reason: null },
      });
    });

    it(`rejects a store on ${entry_type}`, () => {
      assert.ok("error" in parseWorkEntry({ entry_type, store_id: 1 }));
    });

    it(`trims the reason on ${entry_type}`, () => {
      const result = parseWorkEntry({ entry_type, reason: "  Takim në zyrë \n" });
      assert.ok("value" in result);
      assert.equal(result.value.reason, "Takim në zyrë");
    });

    it(`stores a blank reason on ${entry_type} as null`, () => {
      const result = parseWorkEntry({ entry_type, reason: "   " });
      assert.ok("value" in result);
      assert.equal(result.value.reason, null);
    });

    it(`limits the reason length on ${entry_type}`, () => {
      assert.ok("value" in parseWorkEntry({ entry_type, reason: "a".repeat(REASON_MAX_LENGTH) }));
      assert.ok("error" in parseWorkEntry({ entry_type, reason: "a".repeat(REASON_MAX_LENGTH + 1) }));
    });
  }

  it("rejects an unknown type and a non-text reason", () => {
    assert.ok("error" in parseWorkEntry({ entry_type: "vacation" }));
    assert.ok("error" in parseWorkEntry({ entry_type: "other_work", reason: { a: 1 } }));
  });
});
