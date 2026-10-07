import { useEffect, useRef, useState } from "react";
import { getDoctorTodayAvailability, blockDoctorToday, unblockDoctorToday } from "../services/doctorTodayAvailabilityApi";
import { createDoctorTodayAvailabilityController } from "../utils/doctorTodayAvailabilityController";

export function useDoctorTodayAvailability(appointments) {
  const [state, setState] = useState({ date: "", slots: [], blockedTimes: [], durationMinutes: null, loading: true, saving: false, error: "" });
  const controller = useRef(null);
  useEffect(() => {
    const current = createDoctorTodayAvailabilityController({
      api: { get: getDoctorTodayAvailability, block: blockDoctorToday, unblock: unblockDoctorToday },
      onChange: setState,
    });
    controller.current = current;
    const reload = () => current.refresh();
    const onVisible = () => { if (document.visibilityState === "visible") reload(); };
    // Keep initial updates outside the effect's synchronous render path.
    queueMicrotask(reload);
    window.addEventListener("focus", reload);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      current.dispose();
      window.removeEventListener("focus", reload);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [appointments]);
  return { ...state, refresh: () => controller.current?.refresh(), block: time => controller.current?.block(time), unblock: id => controller.current?.unblock(id) };
}
