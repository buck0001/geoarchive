export function safeReturnTo(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\r\n]/.test(value)) {
    return "/";
  }

  try {
    const url = new URL(value, "https://geoarchive.invalid");
    if (url.origin !== "https://geoarchive.invalid") return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}
