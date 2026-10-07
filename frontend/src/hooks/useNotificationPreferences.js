import { useEffect, useRef, useState } from "react";
import { getNotificationPreferences, saveNotificationPreferences } from "../services/notificationPreferencesApi";

// AuthProvider remounts its children on account/session changes. No preferences
// are cached across users or stored in browser storage.
export function useNotificationPreferences() {
  const [prefs, setPrefs] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState(0);
  const savingRef = useRef(false);

  useEffect(() => {
    let active = true;
    getNotificationPreferences().then(preferences => {
      if (active) { setPrefs(preferences); setLoaded(true); }
    }).catch(requestError => {
      if (active) setError(requestError.message || "Notification preferences could not be loaded.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);

  function retry() {
    setError(""); setLoading(true); setAttempt(value => value + 1);
  }

  function changePreferences(next) {
    if (!loaded || loading || savingRef.current) return;
    setPrefs(next); setMessage(""); setError("");
  }

  async function save() {
    if (!loaded || loading || savingRef.current) return;
    savingRef.current = true;
    setSaving(true); setError(""); setMessage("");
    try {
      const preferences = await saveNotificationPreferences(prefs);
      setPrefs(preferences);
      setMessage("Notification preferences saved.");
    } catch (requestError) {
      setError(requestError.message || "Notification preferences could not be saved.");
    } finally { savingRef.current = false; setSaving(false); }
  }

  return { prefs, setPrefs: changePreferences, loaded, loading, saving, error, message, retry, save, disabled: !loaded || loading || saving };
}
