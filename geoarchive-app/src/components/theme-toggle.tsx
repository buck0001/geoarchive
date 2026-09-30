"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect } from "react";

export default function ThemeToggle() {
  useEffect(() => {
    document.documentElement.dataset.theme =
      window.localStorage.getItem("geoarchive.theme") === "dark" ? "dark" : "light";
  }, []);

  function toggleTheme() {
    const dark = document.documentElement.dataset.theme !== "dark";
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    window.localStorage.setItem("geoarchive.theme", dark ? "dark" : "light");
  }

  return (
    <button className="icon-button theme-toggle" type="button" onClick={toggleTheme} aria-label="Toggle color theme">
      <Sun className="theme-icon-light" size={17} />
      <Moon className="theme-icon-dark" size={17} />
    </button>
  );
}
