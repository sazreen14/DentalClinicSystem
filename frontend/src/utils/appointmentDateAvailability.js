export const NO_SAME_DAY_AVAILABILITY_MESSAGE = "The clinic is closed or no appointment slots remain for today. Please select another date.";

export function tomorrowFromClinicDate(clinicDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clinicDate || "")) return "";
  const date = new Date(`${clinicDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function sameDayAvailabilityAdjustment(selectedDate, response, currentMinimum = "") {
  const slots = response?.slots || [];
  const unavailableToday = Boolean(selectedDate && selectedDate === response?.clinicDate && slots.length === 0);
  return {
    clearSelectedDate: unavailableToday,
    minimumDate: unavailableToday ? tomorrowFromClinicDate(response.clinicDate) : currentMinimum,
    message: unavailableToday ? NO_SAME_DAY_AVAILABILITY_MESSAGE : "",
  };
}
