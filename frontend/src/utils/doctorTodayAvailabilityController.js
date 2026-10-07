// Server responses are the only source of available times. Expire each snapshot
// at the server's next minute boundary; never keep stale slots on load failure.
export function createDoctorTodayAvailabilityController({ api, onChange, schedule = setTimeout, cancel = clearTimeout, elapsed = () => performance.now() }) {
  let state = { date: "", slots: [], blockedTimes: [], durationMinutes: null, loading: true, saving: false, error: "" };
  let generation = 0, timer, disposed = false, mutating = false;
  const publish = changes => { state = { ...state, ...changes }; if (!disposed) onChange(state); };

  async function refresh() {
    if (disposed || mutating) return;
    const request = ++generation;
    cancel(timer);
    const started = elapsed();
    publish({ loading: true, slots: [], error: "" });
    try {
      const result = await api.get();
      if (disposed || request !== generation) return;
      const remaining = Date.parse(result.expiresAt) - Date.parse(result.generatedAt) - (elapsed() - started);
      // A delayed response can already be stale; don't briefly show its slots.
      if (remaining <= 0) { timer = schedule(refresh, 0); return; }
      publish({ ...result, loading: false, error: "" });
      timer = schedule(refresh, Math.min(remaining, 30000));
    } catch (error) {
      if (disposed || request !== generation) return;
      publish({ loading: false, slots: [], error: error.message || "Today's availability could not be loaded." });
      timer = schedule(refresh, 30000);
    }
  }

  async function mutate(work) {
    if (disposed || mutating || state.loading) return;
    mutating = true;
    ++generation;
    cancel(timer);
    publish({ saving: true, slots: [], error: "" });
    let failure;
    try { await work(); } catch (error) { failure = error.message || "The blocked time could not be updated."; }
    finally { mutating = false; }
    if (disposed) return;
    await refresh();
    publish({ saving: false, ...(failure ? { error: failure } : {}) });
  }

  return {
    refresh,
    block(time) {
      if (!state.slots.includes(time)) return Promise.resolve();
      const date = state.date;
      return mutate(() => api.block(date, time));
    },
    unblock(id) { return mutate(() => api.unblock(id)); },
    dispose() { disposed = true; ++generation; cancel(timer); },
  };
}
