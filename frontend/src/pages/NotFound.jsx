import { Link } from "react-router-dom";
import { FaArrowLeft, FaTooth } from "react-icons/fa";

import "../styles/NotFound.css";

function NotFound() {
  return (
    <main className="not-found-page">
      <section className="not-found-card">
        <div className="not-found-icon"><FaTooth /></div>
        <span>404</span>
        <h1>Page not found</h1>
        <p>The page you requested does not exist or may have moved.</p>
        <Link to="/"><FaArrowLeft />Return Home</Link>
      </section>
    </main>
  );
}

export default NotFound;
