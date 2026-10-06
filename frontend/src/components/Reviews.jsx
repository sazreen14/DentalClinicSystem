import { FaExternalLinkAlt, FaGoogle, FaStar, FaQuoteLeft } from "react-icons/fa";
import { publicClinicConfig } from "../config/publicClinicConfig";
import { getGoogleReviewsLinkState } from "../utils/reviewsPresentation";
import "../styles/Reviews.css";

// Selected public excerpts supplied by the clinic; relative dates are from that source.
const selectedReviews = [
  { name: "IR. NOORSYARINI ROSARIA BINTI NO...", date: "5 months ago", text: "My appointment was at 11.00am Saturday, but still had to wait around 45 minutes. But, luckily attended DR was attentive and professionally handled the session. I'm truly satisfy and plan to have another session soon to remove my wisdom ..." },
  { name: "Cappuccino Latte", date: "2 years ago", text: "Came here for tooth extraction before wearing braces. Guess what? It didn't even hurt at all, for a very sensitive person like me even after the anesthesia wear off. The Dr's voice and action also calmed me down during the process. Their staffs also very friendly and overall is good. ✨" },
  { name: "Yatie", date: "2 years ago", text: "Service bagus, cara doc explain the procedure quite good & mudah faham, and place were comfortable for patient. If you are very sensitive to coldness ( aircond ) is better to wear a thick clothes when you visit." },
];

function Reviews() {
  const reviewUrl = publicClinicConfig.googleReviewsUrl;
  const linkAvailable = getGoogleReviewsLinkState(reviewUrl) === "available";
  function reviewLink(label, secondary = false) {
    return linkAvailable ? <a className={`reviews-cta${secondary ? " reviews-cta-secondary" : ""}`} href={reviewUrl} target="_blank" rel="noopener noreferrer" aria-label={`${label} (opens in a new tab)`}>{label}<FaExternalLinkAlt aria-hidden="true" /></a> : null;
  }
  return (
    <section className="reviews-section" id="reviews" aria-labelledby="reviews-title">
      <div className="container">
        <div className="reviews-hero">
          <header className="reviews-header">
            <span className="reviews-eyebrow">PATIENT REVIEWS</span>
            <h2 id="reviews-title">What Our Patients<br /><em>Say About Us</em></h2>
            <p>We are grateful for the trust and support from our patients. Read their experiences and share your own review on Google.</p>
            <div className="reviews-actions">{reviewLink("View Google Reviews")}{reviewLink("Write a Review", true)}</div>
            <span className="reviews-trust"><FaExternalLinkAlt aria-hidden="true" /> Opens the official Google Reviews page</span>
            {!linkAvailable && <p className="reviews-unavailable" role="status">Google review link unavailable. Please contact the clinic for its Google Reviews link.</p>}
          </header>
          <div className="reviews-hero-visual">
            <img className="reviews-clinic-photo" src="/clinic-reviews.jpg" alt="Klinik Pergigian Rosni Adam wall logo and white orchids" width="444" height="450" />
            <article className="reviews-floating-card">
              <div className="reviews-google-heading"><span aria-hidden="true"><FaGoogle /></span><div><small>Google Reviews</small><h3>Klinik Pergigian Rosni Adam</h3></div></div>
              <div className="reviews-decorative-stars" aria-hidden="true">{[0,1,2,3,4].map(star => <FaStar key={star} />)}</div>
              <p>View patient experiences on Google</p>
              {reviewLink("View Reviews on Google", true)}
            </article>
          </div>
        </div>
        <section className="reviews-experiences" aria-label="Selected patient reviews">
          <div className="reviews-patient-grid">
            {selectedReviews.map((review) => <article className="reviews-patient-card" key={review.name}>
              <header><span className="reviews-patient-avatar" aria-hidden="true">{review.name[0]}</span><h4>{review.name}</h4><FaGoogle className="reviews-patient-google" aria-hidden="true" /></header>
              <div className="reviews-patient-meta"><span className="reviews-patient-stars" role="img" aria-label="5 out of 5 stars">{[0,1,2,3,4].map(star => <FaStar key={star} aria-hidden="true" />)}</span><span>{review.date}</span></div>
              <FaQuoteLeft className="reviews-patient-quote" aria-hidden="true" />
              <blockquote>{review.text}</blockquote>
              <footer><span>Google Review</span><FaExternalLinkAlt aria-hidden="true" /></footer>
            </article>)}
          </div>
          <div className="reviews-actions">{reviewLink("View All Reviews on Google")}</div>
          <p className="reviews-excerpts-note">Reviews shown above are selected public reviews from Google.<br />Static excerpts; relative dates reflect the supplied source and are not updated live.</p>
        </section>

      </div>
    </section>
  );
}
export default Reviews;
