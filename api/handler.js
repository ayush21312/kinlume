import handler from "../server/index.js";

export default async function api(request, response) {
  const url = new URL(request.url, "https://kinlume.vercel.app");
  const route = url.searchParams.get("route");
  if (route) {
    url.pathname = "/api/" + route;
    url.searchParams.delete("route");
    request.url = url.pathname + url.search;
  }
  return handler(request, response);
}
