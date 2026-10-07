import { apiRequest } from "./apiClient";

export const getDoctorTodayAvailability = () => apiRequest("/doctor/availability/today").then(result => result.availability);
export const blockDoctorToday = (date, time) => apiRequest("/doctor/blocked-times/today", {
  method: "POST", body: JSON.stringify({ date, time }),
});
export const unblockDoctorToday = id => apiRequest(`/doctor/blocked-times/today/${id}`, { method: "DELETE" });
