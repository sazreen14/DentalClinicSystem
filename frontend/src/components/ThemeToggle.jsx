import { FaMoon, FaSun } from "react-icons/fa";
import { useTheme } from "../context/useTheme";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";
  return <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${dark ? "Light" : "Dark"} Mode`} title={`Switch to ${dark ? "Light" : "Dark"} Mode`}>{dark ? <FaSun aria-hidden="true" /> : <FaMoon aria-hidden="true" />}<span>{dark ? "Light" : "Dark"}</span></button>;
}
