# Bergen County resource snapshot

Source review date: **October 18, 2026**. This is a researched snapshot, not live
inventory or confirmation by phone. No organization is represented as an app
partner. The source date refers to our review, not the publisher's update date.

## Public county pantry listings

The county Office of Food Security links to the pantry finder:
https://bergencountynj.gov/bergen-county-department-of-human-services/bergen-county-office-of-food-security/

2026 public map:
https://healthgis.co.bergen.nj.us/portal/apps/experiencebuilder/experience/?id=b820815bcc534edebe3d8a1b88122e44

Published map layer:
https://healthgis.co.bergen.nj.us/arcgis/rest/services/Hosted/service_4e86a66066374018b3770a97f5581bbf/FeatureServer/0

Only records included by the map's `exclude = 'No'` filter were considered.
The starter dataset includes county record IDs 1, 3, 7, 10, 28, 35, 39, 44,
52, 53, 62, 66, 67, 69, 70, 71, 88, and 95. It is not an exhaustive directory.
Only public service details and coordinates were imported. Respondent names,
private survey contacts, operational budgets, and client information were not
imported. A county listing does not establish unrestricted eligibility.

## Organization corrections and additional services

- CFA Hackensack: https://cfanj.org/location/cfa-hackensack/
- CFA Mahwah: https://cfanj.org/location/cfa-mahwah/
- CFA Saddle Brook: https://cfanj.org/location/cfa-saddle-brook/
- CFA Englewood: https://cfanj.org/location/englewood-headquarters/
- CFA eligibility: https://cfanj.org/programs/emergency-food-assistance/
- Epiphany food/toiletries: https://www.epiphanyrcchurch.org/parish-ministries/epiphany-community-food-pantry
- WRIC Career Closet: https://www.womensrights.org/services-overview-2-1
- Bergen SNAP office/application links: https://www.bcbss.com/
- GBCA LIHEAP/USF: https://www.greaterbergen.org/liheap
- State energy-assistance agency confirmation: https://www.nj.gov/dca/dhcr/offices/Liheap-usf-agencylist.shtml
- WIC Teaneck site: https://www.nj.gov/health/fhs/wic/documents/WIC_offices.pdf
- WIC local agency schedules: https://www.nj.gov/health/fhs/wic/participants/find-wic/findlocal.shtml

### Conflicts handled

- Replaced the county's apparent `4:30 am` CFA hours with distribution schedules
  from each organization's location page. Office hours are not distribution hours.
- CFA Englewood uses 75 Knickerbocker Road for visits. The West Demarest Avenue
  address is described as its mailing address by the organization.
- The Annie Clyde Holt listing mentions Friday appointments but has a contradictory
  appointment field. The interface tells visitors to call to confirm.
- Closter was not included because its listed address and distribution location
  differed. No pin was inferred for it.
- WIC Teaneck was selected because its address agrees across state sources. The
  Hackensack WIC sources contain a 15/215 State Street discrepancy and were not used.
- GBCA uses 392 Main Street as the walk-in location, not its separate mailing address.

## Coordinates

County entries use geometry from the county's published geocoded layer, projected
to WGS84. Four added public business addresses were matched by the US Census
address-range geocoder; Bergen SNAP was matched by NJ GIS. Each record identifies
its coordinate source. Geocoded positions are approximate, not verified entrances.

- US Census geocoder: https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html
- NJ GIS service: https://geo.nj.gov/arcgis/rest/services/Tasks/NJ_Geocode/GeocodeServer

CFA Englewood did not produce a confident match. It has no map pin, and remains
available through search, its published address, and an address-based Directions
link. Never insert a nearby town center or mailing-address pin as a substitute.

## Maps and refresh

Leaflet renders the map. Standard OpenStreetMap tiles supply the basemap and
require visible attribution, ordinary interactive use, and normal browser caching:
https://operations.osmfoundation.org/policies/tiles/

There are no offline downloads, bulk tile downloads, or background tile scans.
Provider URL and attribution can be changed through .env.local. Reassess a tile
hosting provider before broad public use. No visitor geocoding is performed. Near me requests browser location only on a button
press, keeps it in memory, and centers the map. The tile provider sees requests for
the displayed map area; precise coordinates are not sent to the assistant. Directions links open the user's selected address
in Google Maps when clicked.

Resource data lives in src/data/resources.json. To update a listing, check its
source, resolve discrepancies, update its facts and sourceCheckedAt, then run tests.
Do not automatically overwrite organization corrections with a county import.
For ongoing operation, arrange a data-sharing/update process with the county and
organizations. Public availability does not establish an unrestricted bulk
redistribution license; confirm reuse terms before publishing a larger directory.

Giving links point to official organization websites. The pledge UI has been removed.
The item donation instructions were reviewed October 18, 2026:

- https://cfanj.org/donate-food/
- https://www.epiphanyrcchurch.org/parish-ministries/epiphany-community-food-pantry
- https://www.womensrights.org/wish-lists
  These are not live supply counts or proof that every item will be accepted.
  Nonprofit submissions are local drafts, not public or verified directory entries.

## Live API integration — October 19, 2026

Feed America API documentation: https://feedam.org/api/openapi.json
Search uses /api/resources/search with zip (a city/state string is also accepted),
mode, radius=15, and bounded result limits. The app requests free, wic, health, school,
or summer modes. It does not use SNAP retailer results as free assistance locations.
The API's upstream data_source and last_verified_date are retained; fetched/review dates
are separate from a claim of contacting the organization. API results are not independently
verified app partners. Duplicates are merged when address, service type, and names agree.
There is no universal guarantee that every duplicate or incorrect provider label is removed.

Program referrals link to USDA SNAP state agencies, HHS LIHEAP, and CareerOneStop.
Volunteer referrals link to Volunteer.gov, Bergen Volunteers, and CFA's current volunteer
page: https://cfanj.org/volunteer/. They are directories/application information, not an
assertion of a current opening or guaranteed eligibility. Their source dates are in programs.json.
Feed America directory coverage is US-focused; this does not establish worldwide coverage.

If live lookup fails, Bergen snapshots may be shown with an explicit offline notice.
Another city never silently receives Bergen records as nearby results.
The provider's attribution is retained on each API listing. Review its reuse terms and
underlying source terms for a public deployment; do not infer a photo license from a
resource directory's data license.

## Employment referrals reviewed October 21, 2026

- Bergen County Job Center: https://bergenjobcenter.com/contact/ — 60 State Street, Hackensack; employment/training contact and departmental hours. No map coordinate was inferred.
- New Jersey Job Source: https://jobsource.nj.gov/ — linked by https://www.nj.gov/labor/career-services/. Statewide online search portal, not an in-app live vacancies feed.

Job requests prioritize paid employment over the generic word opportunities. Career clothing remains available in clothing searches and is excluded from job-chat candidates.
