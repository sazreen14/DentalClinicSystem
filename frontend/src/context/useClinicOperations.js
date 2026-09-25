import { createContext, useContext } from "react";

export const ClinicOperationsContext = createContext(null);

export function useClinicOperations() {
  const value = useContext(ClinicOperationsContext);
  if (!value) throw new Error("useClinicOperations must be used within ClinicOperationsProvider");
  return value;
}

export function formatClinicTime(time) {
  if (!time || typeof time !== "string") return "";
  return new Date(`2026-08-09T${time}:00`).toLocaleTimeString("en-MY", { hour:"numeric", minute:"2-digit" });
}

export function groupOperatingHours(hours = []) {
  const groups = [];
  if (!Array.isArray(hours)) return groups;
  hours.forEach((item) => {
    const key = `${item.open}-${item.start}-${item.end}`;
    const previous = groups.at(-1);
    if (previous?.key === key) previous.days.push(item.day);
    else groups.push({ key, days:[item.day], open:item.open, start:item.start, end:item.end });
  });
  return groups.map((group) => ({
    ...group,
    label:group.days.length > 2 ? `${group.days[0]} – ${group.days.at(-1)}` : group.days.join(" & "),
  }));
}
