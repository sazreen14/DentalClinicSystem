import { FaCalendarAlt, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { isScheduleDate, moveScheduleDate, scheduleDateLabel } from "../utils/scheduleDates";
import "../styles/ScheduleDateNavigation.css";

export default function ScheduleDateNavigation({ selectedDate, onDateChange, view = "week", className = "" }) {
  const label = scheduleDateLabel(selectedDate, view);
  return <div className={`schedule-date-navigation ${className}`} aria-label="Schedule date navigation">
    <button type="button" aria-label={`Previous ${view}`} onClick={() => onDateChange(moveScheduleDate(selectedDate, -1, view))}><FaChevronLeft /></button>
    <label className="schedule-date-picker">
      <span aria-hidden="true">{label}</span><FaCalendarAlt aria-hidden="true" />
      <input type="date" aria-label="Choose schedule date" title="Choose schedule date" value={selectedDate}
        onClick={event => {
          // Native date controls remain usable when showPicker is unsupported.
          try { event.currentTarget.showPicker?.(); } catch { event.currentTarget.focus(); }
        }}
        onChange={event => { if (isScheduleDate(event.target.value)) onDateChange(event.target.value); }} />
    </label>
    <button type="button" aria-label={`Next ${view}`} onClick={() => onDateChange(moveScheduleDate(selectedDate, 1, view))}><FaChevronRight /></button>
  </div>;
}
