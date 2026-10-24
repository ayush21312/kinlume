// An unavailable API may return HTML. Keep that implementation detail out of the UI.
export async function responseJson(response) {
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error("The service is unavailable. Please try again shortly.");
  try {
    return await response.json();
  } catch {
    throw new Error(
      "The service returned an incomplete response. Please try again.",
    );
  }
}
