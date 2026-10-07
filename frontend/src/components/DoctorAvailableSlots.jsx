import { useState } from "react";
import { FaLock } from "react-icons/fa";

export function formatSlotTime(time) {
  const [hour, minute] = time.split(":").map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

export default function DoctorAvailableSlots({ availability }) {
  const [selected, setSelected] = useState("");
  const time = availability.slots.includes(selected) ? selected : "";
  const busy = availability.loading || availability.saving;
  const endMinutes = time ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) + availability.durationMinutes : 0;
  const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
  return <article className="doctor-schedule-side-card">
    <div className="doctor-schedule-side-heading"><span>Open Today</span><h3>Available Time Slots</h3></div>
    {busy && <p className="doctor-availability-message" role="status">{availability.saving ? "Updating blocked time..." : "Loading today's availability..."}</p>}
    {availability.error && <p className="doctor-availability-message" role="alert">{availability.error} <button type="button" onClick={availability.refresh} disabled={busy}>Retry</button></p>}
    {!busy && !availability.error && !availability.slots.length && <p className="doctor-availability-message">No available time slots for today.</p>}
    {!busy && availability.slots.length > 0 && <>
      <p className="doctor-availability-message">Select a time to block.</p>
      <div className="doctor-available-slots" role="group" aria-label="Today's available time slots">
        {availability.slots.map(slot => <button type="button" key={slot} aria-pressed={time === slot} onClick={() => setSelected(slot)}>{formatSlotTime(slot)}</button>)}
      </div>
      {time && <p className="doctor-availability-message">Block {formatSlotTime(time)}–{formatSlotTime(endTime)} ({availability.durationMinutes} minutes).</p>}
    </>}
    <button type="button" className="doctor-block-slot-action" disabled={busy || !time} onClick={() => availability.block(time)}><FaLock /> Block Time Slot</button>
  </article>;
}
