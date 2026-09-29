function publicValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

const VERIFIED_GOOGLE_REVIEWS_URL = "https://www.google.com/maps/place/Klinik+Pergigian+Rosni+Adam/@3.1028352,101.7114285,17z/data=!4m8!3m7!1s0x31cc35fa6c752515:0xaba352b96392583!8m2!3d3.1028352!4d101.7140034!9m1!1b1!16s%2Fg%2F1tzvt15c";

export const publicClinicConfig = Object.freeze({
  googleReviewsUrl: publicValue(import.meta.env.VITE_GOOGLE_REVIEWS_URL) || VERIFIED_GOOGLE_REVIEWS_URL,
});
