import { useEffect, useRef } from "react";
import { FaArrowRight, FaClock, FaEnvelope, FaMapMarkerAlt, FaPhoneAlt } from "react-icons/fa";
import { formatClinicTime, groupOperatingHours, useClinicOperations } from "../context/useClinicOperations";
import "../styles/Location.css";

function Location() {
  const sectionRef = useRef(null);
  const { clinicInfo, operatingHours } = useClinicOperations();
  const hourGroups = groupOperatingHours(operatingHours);
  const phoneHref = `tel:${clinicInfo.phone.replace(/\D/g, "")}`;
  const mapsEmbedKey = import.meta.env.VITE_GOOGLE_MAPS_EMBED_KEY?.trim();
  const configuredPlaceId = import.meta.env.VITE_GOOGLE_MAPS_PLACE_ID?.trim();
  const mapQuery = configuredPlaceId ? `place_id:${configuredPlaceId}` : clinicInfo.address;
  const mapSource = mapsEmbedKey && mapQuery
    ? `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(mapsEmbedKey)}&q=${encodeURIComponent(mapQuery)}`
    : `https://www.google.com/maps?q=${encodeURIComponent(clinicInfo.address)}&output=embed`;
  const directionsUrl = clinicInfo.address ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(clinicInfo.address)}` : "https://www.google.com/maps";

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return undefined;
    const elements = [...section.querySelectorAll("[data-location-reveal]")];
    section.classList.add("location-motion-ready");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("is-revealed"));
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add("is-revealed"); observer.unobserve(entry.target); } }), { threshold: .18, rootMargin: "0px 0px -8% 0px" });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return <section className="location-section" id="location" ref={sectionRef}>
    <div className="container">
      <div className="location-layout">
        <div className="location-left">
          <div className="location-heading" data-location-reveal style={{ "--location-delay": "0ms" }}><span>Clinic Location</span><h2>Find Us Easily</h2><p>Visit {clinicInfo.clinicName} or contact the clinic before making your appointment.</p></div>
          <div className="location-info-grid">
            <article className="location-card" data-location-reveal style={{ "--location-delay": "100ms" }}><div className="location-icon"><FaMapMarkerAlt /></div><div className="location-card-content"><h3>Address</h3><p>{clinicInfo.address}</p></div></article>
            <article className="location-card" data-location-reveal style={{ "--location-delay": "220ms" }}><div className="location-icon"><FaPhoneAlt /></div><div className="location-card-content"><h3>Contact</h3><div className="contact-list"><a href={phoneHref} className="contact-item"><FaPhoneAlt /><span>{clinicInfo.phone}</span></a><a href={`mailto:${clinicInfo.email}`} className="contact-item"><FaEnvelope /><span>{clinicInfo.email}</span></a></div></div></article>
            <article className="location-card operating-hours-card" data-location-reveal style={{ "--location-delay": "340ms" }}><div className="location-icon"><FaClock /></div><div className="operating-hours-content"><h3>Operating Hours</h3><div className="hours-list">{hourGroups.map((group) => <div className="hours-row" key={group.key}><span>{group.label}</span><strong className={group.open ? "" : "closed-text"}>{group.open ? `${formatClinicTime(group.start)} – ${formatClinicTime(group.end)}` : "Closed"}</strong></div>)}</div></div></article>
          </div>
        </div>

        <div className="location-map-card" data-location-reveal style={{ "--location-delay": "160ms" }}>
          <iframe title={`${clinicInfo.clinicName} Location`} src={mapSource} loading="lazy" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
          <div className="location-map-content"><span>Clinic Location</span><h3>{clinicInfo.clinicName || "Klinik Pergigian Rosni Adam"}</h3><p>{clinicInfo.address || "Clinic address is currently unavailable."}</p><a href={directionsUrl} target="_blank" rel="noreferrer"><FaMapMarkerAlt/><strong>Open directions in Google Maps</strong><FaArrowRight className="location-button-arrow"/></a></div>
        </div>
      </div>
    </div>
  </section>;
}

export default Location;
