/**
 * Theme provider that syncs the Zustand theme store with the DOM.
 * Adds/removes the 'dark' class on the <html> element.
 * Persists preference to localStorage.
 */

"use client";

import { useEffect } from "react";
import { useThemeStore } from "@/lib/store";

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme, setTheme } = useThemeStore();

  useEffect(() => {
    // Load saved theme on mount
    const saved = localStorage.getItem("certai-theme") as
      | "light"
      | "dark"
      | null;
    if (saved) {
      setTheme(saved);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
    }
  }, [setTheme]);

  useEffect(() => {
    // Sync theme class to <html> element
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("certai-theme", theme);
  }, [theme]);

  return <>{children}</>;
}
