import { useState } from "react";
import { API_BASE_URL } from "../../services/apiClient";

function PatientAvatar({ className, photoUrl, initials, alt = "" }) {
  const [failedUrl, setFailedUrl] = useState("");
  const apiOrigin = new URL(API_BASE_URL, window.location.origin).origin;
  const src = photoUrl ? new URL(photoUrl, apiOrigin).href : "";

  return (
    <div className={className}>
      {src && failedUrl !== src
        ? <img src={src} alt={alt} onError={() => setFailedUrl(src)} />
        : initials || "P"}
    </div>
  );
}

export default PatientAvatar;
