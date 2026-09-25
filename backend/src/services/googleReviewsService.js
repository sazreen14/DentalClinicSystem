import { env } from "../config/env.js";

export const GOOGLE_REVIEWS_FIELD_MASK = "displayName,rating,userRatingCount,reviews,googleMapsUri";

function normalizedReview(review) {
  return {
    reviewerName: review.authorAttribution?.displayName || "Google user",
    reviewerUrl: review.authorAttribution?.uri || "",
    rating: Number(review.rating) || 0,
    text: review.text?.text || review.originalText?.text || "",
    relativeTime: review.relativePublishTimeDescription || "",
    publishedAt: review.publishTime || null,
  };
}

export function normalizeGooglePlace(place = {}) {
  return {
    available: true,
    placeName: place.displayName?.text || "",
    rating: Number(place.rating) || 0,
    totalReviewCount: Number(place.userRatingCount) || 0,
    googleMapsUrl: place.googleMapsUri || "",
    reviews: Array.isArray(place.reviews) ? place.reviews.map(normalizedReview) : [],
  };
}

function upstreamReason(status) {
  if (status === 400 || status === 404) return "invalid_place";
  if (status === 401 || status === 403) return "upstream_forbidden";
  if (status === 429) return "upstream_quota";
  return "upstream_unavailable";
}

export function createGoogleReviewsService(config = env.googlePlaces, fetchImpl = fetch, logger = console) {
  let cache = null;
  return async function getGoogleReviews() {
    if (!config.apiKey || !config.placeId) {
      logger.warn?.("[Google Reviews] Integration is not configured; check backend Google Places environment variables.");
      return { available: false, reason: "not_configured", message: "Google Reviews are currently unavailable." };
    }
    if (cache && cache.expiresAt > Date.now()) return cache.value;
    try {
      const response = await fetchImpl(`https://places.googleapis.com/v1/places/${encodeURIComponent(config.placeId)}`, {
        headers: { "X-Goog-Api-Key": config.apiKey, "X-Goog-FieldMask": GOOGLE_REVIEWS_FIELD_MASK },
        signal: AbortSignal.timeout(config.timeoutMs),
      });
      if (!response.ok) {
        const reason = upstreamReason(response.status);
        logger.warn?.("[Google Reviews] Google Places request failed.", { status: response.status, reason });
        return { available: false, reason, message: "Google Reviews are currently unavailable." };
      }
      const value = normalizeGooglePlace(await response.json());
      cache = { value, expiresAt: Date.now() + config.cacheTtlMs };
      return value;
    } catch (error) {
      logger.warn?.("[Google Reviews] Google Places request could not be completed.", { errorType: error?.name || "Error" });
      return { available: false, reason: "upstream_unavailable", message: "Google Reviews are currently unavailable." };
    }
  };
}

export const getGoogleReviews = createGoogleReviewsService();
