import { useEffect, useRef } from "react";
import { FaCalendarAlt, FaClock } from "react-icons/fa";
import { TbMessageCircle, TbScan, TbBrush, TbDentalOff, TbDental } from "react-icons/tb";
import { useClinicOperations } from "../context/useClinicOperations";
import "../styles/Services.css";

const servicePresentation = {
  "Dental Consultation": { icon: TbMessageCircle, order: 1 },
  "Dental X-Ray": { icon: TbScan, order: 2 },
  "Scaling & Polishing": { icon: TbBrush, order: 3 },
  "Tooth Extraction": { icon: TbDentalOff, order: 4 },
  "Tooth Filling": { icon: TbDental, order: 5 },
};

function Services({ onBookService }) {
  const sectionRef = useRef(null);
  const { dentalServices: services } = useClinicOperations();
  const activeServices = services
    .filter((service) => service.status !== "Inactive" && servicePresentation[service.name])
    .sort((a, b) => servicePresentation[a.name].order - servicePresentation[b.name].order);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return undefined;
    const animatedElements = [...section.querySelectorAll("[data-services-reveal]")];
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    section.classList.add("services-motion-ready");

    if (reducedMotion.matches || !("IntersectionObserver" in window)) {
      animatedElements.forEach((element) => element.classList.add("is-revealed"));
      return () => section.classList.remove("services-motion-ready");
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-revealed");
        observer.unobserve(entry.target);
      });
    }, { threshold: .22, rootMargin: "0px 0px -12% 0px" });
    animatedElements.forEach((element) => observer.observe(element));
    return () => { observer.disconnect(); section.classList.remove("services-motion-ready"); };
  }, [activeServices.length]);

  return <section className="services-section" id="services" ref={sectionRef}><div className="container">
    <div className="services-header"><div><span className="section-eyebrow services-header-reveal" data-services-reveal style={{ "--services-delay": "0ms" }}>Services Available</span><h2 className="services-header-reveal" data-services-reveal style={{ "--services-delay": "100ms" }}>Dental care for every visit</h2><p className="services-header-reveal" data-services-reveal style={{ "--services-delay": "200ms" }}>Choose from the clinic services currently available for registered-patient appointment booking.</p></div><button type="button" className="services-book-btn services-header-reveal" data-services-reveal style={{ "--services-delay": "300ms" }} onClick={onBookService}><FaCalendarAlt />Book Appointment</button></div>
    <div className="services-grid">{activeServices.map((service, index) => {
      const ServiceIcon = servicePresentation[service.name].icon;
      const serviceIcon = <ServiceIcon size="1em" strokeWidth={1.75} style={{ color: "var(--public-accent-strong, var(--accent, #128f92))", verticalAlign: "top" }} aria-hidden="true" />;
      return <article className="service-card service-card-reveal" data-services-reveal style={{ "--services-delay": `${index * 100}ms` }} key={service.id}><div className="service-card-main"><div className="service-icon service-content-reveal" aria-hidden="true">{serviceIcon}</div><div className="service-text-reveal"><span className="service-label">Dental service</span><h3>{service.name}</h3></div></div><div className="service-card-footer service-footer-reveal"><span className="service-duration"><FaClock /> {service.duration} min</span><button type="button" onClick={onBookService}>Book Now <span aria-hidden="true">→</span></button></div></article>;
    })}</div>
  </div></section>;
}

export default Services;
