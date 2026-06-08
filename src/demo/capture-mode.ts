export function isSocialCapture(search?: string) {
  if (typeof window === "undefined") return false
  const query = search ?? window.location.search
  return new URLSearchParams(query).get("capture") === "social"
}
