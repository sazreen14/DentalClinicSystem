import { useEffect, useState } from "react";
import { apiBlobRequest } from "../../services/apiClient";

function PatientAvatar({ className, photoUrl, initials, alt = "" }) {
  const [failedUrl, setFailedUrl] = useState("");
  const [photo, setPhoto] = useState(null);
  useEffect(() => {
    let active = true;
    let objectUrl;
    if (/^\/api\/public\/profile-photos\/[a-f0-9]{48}\.(jpg|png|webp)$/.test(photoUrl || "")) {
      apiBlobRequest(photoUrl.slice(4)).then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPhoto({ key: photoUrl, src: objectUrl });
      }).catch(() => { if (active) setPhoto(null); });
    }
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [photoUrl]);
  const src = photo?.key === photoUrl ? photo.src : "";

  return (
    <div className={className}>
      {src && failedUrl !== src
        ? <img src={src} alt={alt} onError={() => setFailedUrl(src)} />
        : initials || "P"}
    </div>
  );
}

export default PatientAvatar;
