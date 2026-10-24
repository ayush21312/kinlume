export function problem(message, status = 400) {
  return Object.assign(new Error(message), { status });
}
