import { useEffect, useRef } from "react";
import { FaCommentDots, FaExternalLinkAlt, FaGoogle, FaRegComments, FaShieldAlt } from "react-icons/fa";
import { publicClinicConfig } from "../config/publicClinicConfig";
import { getGoogleReviewsLinkState } from "../utils/reviewsPresentation";
import "../styles/Reviews.css";

const reviewHighlights = [
  { icon: FaRegComments, title: "Patient Feedback", description: "Real experiences shared by patients." },
  { icon: FaShieldAlt, title: "Trusted Reviews", description: "Reviews are viewed through the official Google profile." },
  { icon: FaGoogle, title: "Google Profile", description: "Access the latest ratings and feedback directly on Google." },
];

function Reviews() {
  const sectionRef = useRef(null);
  const reviewUrl = publicClinicConfig.googleReviewsUrl;
  const linkAvailable = getGoogleReviewsLinkState(reviewUrl) === "available";

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || !window.IntersectionObserver || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        section.classList.add("reviews-visible");
        observer.disconnect();
      }
    }, { threshold: 0.08 });

    section.classList.add("reviews-motion-ready");
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="reviews-section" id="reviews" ref={sectionRef}>
      <div className="container">
        <header className="reviews-header">
          <span className="reviews-eyebrow">Patient Feedback</span>
          <h2>See What Our Patients Say</h2>
          <p>Explore genuine patient experiences through our official Google profile.</p>
        </header>

        <article className="reviews-feature">
          <div className="reviews-feature-content">
            <div className="reviews-feature-label"><span className="reviews-google-icon" aria-hidden="true"><FaGoogle /></span><span>Google Reviews</span></div>
            <h3>Patient Experiences</h3>
            <p>Hear from patients who have visited our clinic. The latest ratings and feedback are available directly on Google.</p>
            {linkAvailable
              ? <a className="reviews-google-link" href={reviewUrl} target="_blank" rel="noopener noreferrer" aria-label="View Reviews on Google (opens in a new tab)">View Reviews on Google <FaExternalLinkAlt aria-hidden="true" /></a>
              : <div className="google-reviews-link-unavailable" role="status"><strong>Google review link unavailable</strong><span>The clinic&apos;s verified public Google profile URL has not been configured.</span></div>}
          </div>
          <div className="reviews-feature-visual" aria-hidden="true">
            <span className="reviews-visual-orbit reviews-visual-orbit-one" />
            <span className="reviews-visual-orbit reviews-visual-orbit-two" />
            <div className="reviews-visual-emblem"><FaGoogle /></div>
            <div className="reviews-visual-caption"><FaCommentDots /><span>Patient voices, shared on Google</span></div>
          </div>
        </article>

        <div className="reviews-highlights">
          {reviewHighlights.map(({ icon: Icon, title, description }) => (
            <article className="reviews-highlight" key={title}>
              <span className="reviews-highlight-icon" aria-hidden="true"><Icon /></span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Reviews;
