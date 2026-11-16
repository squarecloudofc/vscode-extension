import assert from "node:assert/strict";
import { test } from "node:test";

import {
  classShares,
  cleanFilters,
  dnsPending,
  dnsRole,
  errorRows,
  MAX_WINDOW,
  normalizeDomain,
  presetWindow,
  statusClass,
  toggleFilter,
  validWindow,
  visitRows,
} from "../src/webview/lib/network.ts";

const now = Date.UTC(2026, 10, 15, 15, 0, 42);

test("a preset ends a minute ago on the minute and fits 7 days", () => {
  const w = presetWindow("24h", now);
  assert.equal(w.end, "2026-11-15T14:59:00.000Z");
  assert.equal(w.start, "2026-11-14T14:59:00.000Z");
  const week = presetWindow("7d", now);
  assert.ok(Date.parse(week.end) - Date.parse(week.start) < MAX_WINDOW);
});

test("a custom window starts first, ends by now, within 7 days", () => {
  assert.ok(validWindow(now - 3600_000, now - 60_000, now));
  assert.equal(validWindow(now, now - 1, now), false);
  assert.equal(validWindow(now - 3600_000, now + 60_000, now), false);
  assert.equal(validWindow(now - MAX_WINDOW - 1, now, now), false);
  assert.equal(validWindow(Number.NaN, now, now), false);
});

test("filters: known keys only, a click toggles", () => {
  assert.deepEqual(
    cleanFilters({ country: "BR", ip: "1.2.3.4", path: 3, os: "" }),
    { country: "BR" },
  );
  assert.deepEqual(cleanFilters(null), {});
  assert.deepEqual(toggleFilter({}, "path", "/api"), { path: "/api" });
  assert.deepEqual(toggleFilter({ path: "/api" }, "path", "/api"), {});
  assert.deepEqual(toggleFilter({ path: "/a" }, "path", "/b"), { path: "/b" });
});

test("status classes and their shares", () => {
  assert.equal(statusClass("404"), "4xx");
  assert.equal(statusClass(502), "5xx");
  assert.equal(statusClass("101"), undefined);
  assert.deepEqual(
    classShares([
      { type: "200", requests: 60 },
      { type: "304", requests: 20 },
      { type: "404", requests: 15 },
      { type: "500", requests: 5 },
      { type: "201", requests: 0 },
    ]),
    [
      { cls: "2xx", requests: 60, share: 0.6 },
      { cls: "3xx", requests: 20, share: 0.2 },
      { cls: "4xx", requests: 15, share: 0.15 },
      { cls: "5xx", requests: 5, share: 0.05 },
    ],
  );
});

test("visit rows sum buckets of the same time, in order", () => {
  assert.deepEqual(
    visitRows([
      { date: "2026-11-15T14:00:00Z", visits: 2, requests: 9, bytes: 100 },
      {
        date: "2026-11-15T13:00:00Z",
        visits: 1,
        requests: 3,
        bytes: 50,
        bytes_in: 7,
      },
      { date: "2026-11-15T14:00:00Z", visits: 1, requests: 1, bytes: 10 },
    ]),
    [
      {
        t: Date.parse("2026-11-15T13:00:00Z"),
        visits: 1,
        requests: 3,
        out: 50,
        in: 7,
      },
      {
        t: Date.parse("2026-11-15T14:00:00Z"),
        visits: 3,
        requests: 10,
        out: 110,
        in: 0,
      },
    ],
  );
});

test("error rows add up 4xx and 5xx", () => {
  assert.deepEqual(
    errorRows([
      {
        date: "2026-11-15T14:00:00Z",
        buckets: { "404": 3, "403": 1, "502": 2 },
      },
    ]),
    [{ t: Date.parse("2026-11-15T14:00:00Z"), "4xx": 4, "5xx": 2 }],
  );
});

test("a custom domain is normalised like the site does", () => {
  assert.deepEqual(normalizeDomain("https://Shop.Example.com/path?x"), {
    domain: "shop.example.com",
  });
  assert.deepEqual(normalizeDomain("example.com:8080."), {
    domain: "example.com",
  });
  assert.deepEqual(normalizeDomain("café.com"), { domain: "xn--caf-dma.com" });
  for (const bad of [
    "",
    "localhost",
    "-a.com",
    "a_b.com",
    "1.2.3.4",
    "a b.com",
  ])
    assert.deepEqual(normalizeDomain(bad), { error: "invalid" }, bad);
  assert.deepEqual(normalizeDomain("my-bot.squareweb.app"), {
    error: "reserved",
  });
});

test("DNS records get the site's roles", () => {
  assert.equal(dnsRole({ name: "shop.example.com" }), "traffic");
  assert.equal(dnsRole({ name: "_cf-custom-hostname.shop" }), "ownership");
  assert.equal(dnsRole({ name: "_acme-challenge.shop" }), "certificate");
  assert.equal(dnsRole({ name: "x", fallback: true }), "certificate");
});

test("DNS is looked at again only while records are pending, never after a failure", () => {
  const active = { status: "active" };
  const waiting = { status: "pending_validation" };
  assert.equal(dnsPending(undefined, undefined), true);
  assert.equal(dnsPending([], undefined), true);
  assert.equal(dnsPending([active, waiting], undefined), true);
  assert.equal(dnsPending([active], undefined), false);
  // A failed read is not "pending": it shows its Failure with Retry.
  assert.equal(dnsPending(undefined, new Error("x")), false);
  assert.equal(dnsPending([waiting], new Error("x")), false);
});
