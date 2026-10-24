import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeFeedResource,
  mergeResources,
} from "../src/utils/resourceData.js";
import { hasCoordinates } from "../src/utils/resourceLinks.js";
import { chooseCommonsPhoto } from "../server/photos.js";
import { chatIntent } from "../server/chat.js";
import { searchResources } from "../server/resourceSearch.js";

const row = {
  id: 123,
  name: "Example Food Pantry",
  address: "316 First Street",
  city: "Hackensack",
  state: "NJ",
  zip: "07601",
  lat: 40.89082,
  lng: -74.048241,
  resource_type: "food_pantry",
  is_active: 1,
};

test("provider normalization keeps unknown facts unknown and excludes SNAP grocery stores", () => {
  const record = normalizeFeedResource({
    ...row,
    website: "javascript:alert(1)",
    hours_json: "{bad json",
  });
  assert.equal(record.website, null);
  assert.match(record.hours, /Contact/);
  assert.match(record.appointment, /Confirm/);
  assert.equal(
    normalizeFeedResource({ ...row, resource_type: "snap_retailer" }),
    null,
  );
  assert.equal(normalizeFeedResource({ ...row, is_active: 0 }), null);
});
test("API listings map health and school services to programs without claiming free medical care", () => {
  const health = normalizeFeedResource({
    ...row,
    resource_type: "health_center",
  });
  assert.deepEqual(health.categories, ["programs"]);
  assert.match(health.description, /fees/);
  const school = normalizeFeedResource({
    ...row,
    resource_type: "school_meal",
  });
  assert.equal(school.programType, "school");
  assert.ok(school.categories.includes("programs"));
});
test("equivalent addresses merge duplicate listings while preserving preferred source details", () => {
  const first = {
    ...normalizeFeedResource(row),
    id: "local-source",
    hours: "Verified local hours",
    sourceName: "Organization website",
  };
  const second = normalizeFeedResource({
    ...row,
    id: 124,
    address: "316 1st St",
  });
  const merged = mergeResources([first], [second]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].hours, "Verified local hours");
  assert.equal(merged[0].sourceName, "Organization website");
  assert.deepEqual(merged[0].providerIds, [124]);
});
test("maps accept US locations beyond Bergen County and reject impossible coordinates", () => {
  assert.equal(
    hasCoordinates({ coordinates: { lat: 30.2672, lng: -97.7431 } }),
    true,
  );
  assert.equal(hasCoordinates({ coordinates: { lat: 100, lng: -97 } }), false);
  assert.equal(hasCoordinates({ coordinates: { lat: 0, lng: 0 } }), false);
});
test("Commons photos require a meaningful name, nearby coordinates, and an eligible license", () => {
  const resource = {
    name: "Church of the Epiphany",
    city: "Cliffside Park",
    coordinates: { lat: 40.8277, lng: -73.9839 },
  };
  const page = {
    title: "File:Cliffside Pk Epiphany RCC jeh.JPG",
    coordinates: [{ lat: 40.8278, lon: -73.9839 }],
    imageinfo: [
      {
        thumburl: "https://upload.wikimedia.org/photo.jpg",
        descriptionurl: "https://commons.wikimedia.org/wiki/File:Example",
        extmetadata: {
          LicenseShortName: { value: "CC0" },
          Artist: { value: "<a>Photographer</a>" },
        },
      },
    ],
  };
  assert.equal(chooseCommonsPhoto([page], resource).credit, "Photographer");
  assert.equal(
    chooseCommonsPhoto(
      [{ ...page, coordinates: [{ lat: 51, lon: 0 }] }],
      resource,
    ),
    null,
  );
  assert.equal(
    chooseCommonsPhoto([{ ...page, title: "File:Unrelated.JPG" }], resource),
    null,
  );
  assert.equal(
    chooseCommonsPhoto(
      [
        {
          ...page,
          imageinfo: [
            {
              ...page.imageinfo[0],
              extmetadata: {
                LicenseShortName: { value: "All rights reserved" },
              },
            },
          ],
        },
      ],
      resource,
    ),
    null,
  );
});
test("chat retains the requested type of help across a location-only follow-up", () => {
  const intent = chatIntent({
    profile: { city: "Hackensack, NJ" },
    messages: [
      { role: "user", content: "Find food" },
      { role: "assistant", content: "Here are results" },
      { role: "user", content: "Austin, TX" },
    ],
  });
  assert.equal(intent.category, "food");
  assert.equal(intent.location, "Austin, TX");
  assert.equal(
    chatIntent({
      profile: {},
      messages: [{ role: "user", content: "WIC near 90210" }],
    }).program,
    "wic",
  );
});
test("live search uses selected program mode and does not leak Bergen listings into a different region", async () => {
  const requested = [];
  const result = await searchResources(
    { location: "Seattle, WA", category: "programs", program: "health" },
    {
      fetchImpl: async (url) => {
        requested.push(new URL(url).searchParams.get("mode"));
        return {
          ok: true,
          json: async () => ({
            success: true,
            location: { lat: 47.6, lng: -122.3 },
            resources: [
              {
                ...row,
                id: 999,
                city: "Seattle",
                state: "WA",
                lat: 47.6,
                lng: -122.3,
                resource_type: "health_center",
              },
            ],
          }),
        };
      },
    },
  );
  assert.deepEqual(requested, ["health"]);
  assert.equal(result.resources.length, 1);
  assert.equal(result.resources[0].city, "Seattle");
});
test("an API outage outside the fallback region returns an error instead of false nearby results", async () => {
  await assert.rejects(
    () =>
      searchResources(
        { location: "Phoenix, AZ", category: "food" },
        { fetchImpl: async () => ({ ok: false }) },
      ),
    /unavailable/,
  );
});

test("chat extracts the city from a full sentence instead of treating the sentence as an address", () => {
  const result = chatIntent({
    profile: {},
    messages: [{ role: "user", content: "I need food near Austin, TX" }],
  });
  assert.equal(result.location, "Austin, TX");
  assert.equal(result.category, "food");
});

test("chat keeps follow-up questions out of city queries and preserves place abbreviations", () => {
  for (const content of [
    "Help me find food near Hackensack, NJ. What should I confirm?",
    "Find food near Hackensack, NJ? Can you help?",
    "Food near Hackensack, NJ; I need directions",
  ]) {
    assert.equal(
      chatIntent({ profile: {}, messages: [{ role: "user", content }] })
        .location,
      "Hackensack, NJ",
    );
  }
  assert.equal(
    chatIntent({
      profile: { city: "Hackensack, NJ" },
      messages: [{ role: "user", content: "Find food near me" }],
    }).location,
    "Hackensack, NJ",
  );
  assert.equal(
    chatIntent({
      profile: {},
      messages: [{ role: "user", content: "Food near St. Louis, MO" }],
    }).location,
    "St. Louis, MO",
  );
});
