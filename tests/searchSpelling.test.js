import test from "node:test";
import assert from "node:assert/strict";
import { suggestSearchQuery } from "../src/utils/searchSpelling.js";
import { filterResources } from "../src/utils/filterResources.js";
import { resources } from "../src/data/resources.js";

test("resource typo suggestions preserve the town and work with category filters", () => {
  const query = suggestSearchQuery("foood pnatry Hackensack");
  assert.equal(query, "food pantry Hackensack");
  const matches = filterResources(resources, query, "food");
  assert.ok(matches.length > 0);
  assert.ok(
    matches.every(
      (record) =>
        record.city === "Hackensack" && record.categories.includes("food"),
    ),
  );
});
test("spelling suggestions do not guess city names, alter valid words or drop search constraints", () => {
  assert.equal(suggestSearchQuery("food Hackensak 07601"), "");
  assert.equal(suggestSearchQuery("panty clothing"), "");
  assert.equal(
    suggestSearchQuery("hygeine supplies, New York"),
    "hygiene supplies, New York",
  );
  assert.equal(suggestSearchQuery(""), "");
});
