function publicValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

const VERIFIED_GOOGLE_REVIEWS_URL = "https://maps.app.goo.gl/953SjZxzdNtwLP7LA";

export const publicClinicConfig = Object.freeze({
  googleReviewsUrl: publicValue(import.meta.env.VITE_GOOGLE_REVIEWS_URL) || VERIFIED_GOOGLE_REVIEWS_URL,
});
