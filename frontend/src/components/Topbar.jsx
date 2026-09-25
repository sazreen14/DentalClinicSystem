import "../styles/Topbar.css";
import { formatClinicTime, groupOperatingHours, useClinicOperations } from "../context/useClinicOperations";

function Topbar() {
  const { clinicInfo, operatingHours } = useClinicOperations();
  const primaryHours = groupOperatingHours(operatingHours)[0];
  const hoursLabel = primaryHours
    ? `${primaryHours.label}: ${primaryHours.open ? `${formatClinicTime(primaryHours.start)} - ${formatClinicTime(primaryHours.end)}` : "Closed"}`
    : "Operating hours loading";

  return (
    <div className="topbar">
      <div className="container topbar-content">
        <span>📞 {clinicInfo.phone}</span>
        <span>{hoursLabel}</span>
        <span>Patient information is protected according to PDPA.</span>
      </div>
    </div>
  );
}

export default Topbar;
