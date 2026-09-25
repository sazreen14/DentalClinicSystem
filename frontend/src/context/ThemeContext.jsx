import { useCallback, useMemo, useState } from "react";
import { ThemeContext } from "./useTheme";

const STORAGE_KEY = "dentalClinicTheme";
const initialTheme = () => {
  try { return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light"; }
  catch { return "light"; }
};

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(initialTheme);
  const setTheme = useCallback((value) => {
    const next = value === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* preference persistence may be unavailable */ }
    setThemeState(next);
  }, []);
  const toggleTheme = useCallback(() => setTheme(theme === "dark" ? "light" : "dark"), [setTheme, theme]);
  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
