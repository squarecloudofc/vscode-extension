import type { ServiceStatus } from "@squarecloud/api";
import assert from "node:assert/strict";
import { test } from "node:test";

import { serviceSummary } from "../src/lib/utils/service-status.ts";

const status = (
  word: string,
  incidents: { type: "maintenance" | "incident" }[] = [],
) =>
  ({
    status: word,
    message: "",
    incidents: incidents.map((incident) => ({
      ...incident,
      title: "t",
      status: "degraded",
      started_at: "",
      affected: [],
    })),
  }) as ServiceStatus;

test("nothing fetched, or a check that could not run, is unknown", () => {
  assert.equal(serviceSummary(undefined), "unknown");
  assert.equal(serviceSummary(status("unknown")), "unknown");
});

test("maintenance and degraded are warnings, online is online", () => {
  assert.equal(serviceSummary(status("online")), "online");
  assert.equal(serviceSummary(status("maintenance")), "maintenance");
  assert.equal(serviceSummary(status("degraded")), "degraded");
  // A word the API adds later says something is off.
  assert.equal(serviceSummary(status("partial_outage")), "degraded");
});

test("an open incident shows even while the summary says online", () => {
  assert.equal(
    serviceSummary(status("online", [{ type: "maintenance" }])),
    "maintenance",
  );
  assert.equal(
    serviceSummary(
      status("online", [{ type: "maintenance" }, { type: "incident" }]),
    ),
    "degraded",
  );
});
