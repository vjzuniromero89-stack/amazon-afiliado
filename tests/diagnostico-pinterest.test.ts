import { test } from "node:test";
import assert from "node:assert/strict";
import { summarize } from "../tools/diagnostico-pinterest";

test("diagnosis keeps what the app drops: PROCESSING days with numbers count in 'any', not in 'app'", () => {
  const s = summarize({
    a: {
      all: {
        daily_metrics: [
          { date: "2026-10-20", data_status: "BEFORE_PIN_CREATED", metrics: {} },
          { date: "2026-10-21", data_status: "READY", metrics: { IMPRESSION: 40, OUTBOUND_CLICK: 1, SAVE: 0 } },
          { date: "2026-10-22", data_status: "PROCESSING", metrics: { IMPRESSION: 30, OUTBOUND_CLICK: 2 } },
          { date: "2026-10-23", data_status: "PROCESSING" },
        ],
      },
    },
  });
  assert.equal(s.byDay["2026-10-21"].app.IMPRESSION, 40);
  assert.equal(s.byDay["2026-10-22"].app.IMPRESSION, undefined, "the app drops PROCESSING");
  assert.equal(s.byDay["2026-10-22"].any.IMPRESSION, 30);
  assert.deepEqual(
    { rows: s.statuses.PROCESSING.rows, withNumbers: s.statuses.PROCESSING.withNumbers, imp: s.statuses.PROCESSING.IMPRESSION },
    { rows: 2, withNumbers: 1, imp: 30 },
  );
  assert.equal(s.statuses.BEFORE_PIN_CREATED.withNumbers, 0);
});
