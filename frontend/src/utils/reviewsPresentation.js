export function getGoogleReviewsLinkState(value) {
  if (!value) return "missing";
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const googleHost = host === "g.page" || host === "maps.app.goo.gl" || host.endsWith(".google.com") || /^google\.[a-z.]+$/.test(host);
    return url.protocol === "https:" && googleHost ? "available" : "invalid";
  } catch {
    return "invalid";
  }
}
