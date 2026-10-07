// Match the clinic clock used by appointment availability. Keep calendar dates
// as YYYY-MM-DD strings so browser timezone/DST cannot move a selected date.
export function getClinicDateKey(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function isScheduleDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function moveScheduleDate(value, direction, view = "week") {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + direction * (view === "day" ? 1 : 7));
  return date.toISOString().slice(0, 10);
}

export function formatScheduleDate(value, options = { day: "numeric", month: "short" }) {
  return new Intl.DateTimeFormat("en-MY", { ...options, timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

export function getScheduleDays(selectedDate, view = "week") {
  const weekday = (new Date(`${selectedDate}T00:00:00Z`).getUTCDay() + 6) % 7;
  const start = view === "day" ? selectedDate : moveScheduleDate(selectedDate, -weekday, "day");
  return Array.from({ length: view === "day" ? 1 : 7 }, (_, offset) => {
    const date = moveScheduleDate(start, offset, "day");
    return { date, name: formatScheduleDate(date, { weekday: "long" }), index: view === "day" ? weekday : offset };
  });
}

export function scheduleDateLabel(selectedDate, view = "week") {
  const days = getScheduleDays(selectedDate, view);
  const full = { day: "numeric", month: "short", year: "numeric" };
  if (view === "day") return formatScheduleDate(selectedDate, { ...full, weekday: "short" });
  return `${formatScheduleDate(days[0].date, full)} – ${formatScheduleDate(days[6].date, full)}`;
}

export function scheduleTimeKey(time) {
  const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return time.slice(0, 5);
  const hour = Number(match[1]) % 12 + (match[3].toUpperCase() === "PM" ? 12 : 0);
  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}
