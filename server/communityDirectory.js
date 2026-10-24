import { distanceMiles } from "../src/utils/resourceData.js";
let source = () => [];
export function setCommunityResourceSource(getResources) {
  source = getResources;
}
const normalized = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
function country(value) {
  const text = normalized(value);
  return ["us", "usa", "united states of america"].includes(text)
    ? "united states"
    : ["uk", "gb", "great britain"].includes(text)
      ? "united kingdom"
      : text;
}
export function organizationResults(options, result = {}) {
  const query = normalized(options.location);
  const expectedCountry = result.countryCode
    ? country(
        new Intl.DisplayNames(["en"], { type: "region" }).of(
          result.countryCode,
        ),
      )
    : "";
  return source().filter((resource) => {
    if (
      options.category &&
      options.category !== "all" &&
      !resource.categories.includes(options.category)
    )
      return false;
    if (
      options.program &&
      options.program !== "all" &&
      resource.programType !== options.program
    )
      return false;
    if (result.center && resource.coordinates)
      return distanceMiles(result.center, resource.coordinates) <= 25;
    const city = normalized(resource.city),
      resourceCountry = country(resource.country);
    if (expectedCountry && expectedCountry !== resourceCountry) return false;
    const queryCountry = country(String(options.location).split(",").at(-1));
    const knownCountries = [
      "united states",
      "united kingdom",
      "canada",
      "india",
      "australia",
      "france",
      "germany",
      "japan",
      "italy",
      "spain",
      "brazil",
      "mexico",
    ];
    if (
      !expectedCountry &&
      knownCountries.includes(queryCountry) &&
      queryCountry !== resourceCountry
    )
      return false;
    return query === city || query.startsWith(city + " ");
  });
}

export function getOrganizationResource(id) {
  return source().find((resource) => resource.id === id) || null;
}
