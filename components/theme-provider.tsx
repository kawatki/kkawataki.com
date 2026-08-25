"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

type Theme = "dark" | "light" | "system"
type ResolvedTheme = "dark" | "light"

type ThemeContextValue = {
  resolvedTheme: ResolvedTheme
  setTheme(theme: Theme): void
  theme: Theme
}

const STORAGE_KEY = "rental-japanese-guy:theme"
const ThemeContext = createContext<ThemeContextValue | null>(null)

function systemTheme(): ResolvedTheme {
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark"
  }

  return "light"
}

function storedTheme(): Theme {
  if (typeof window === "undefined") {
    return "system"
  }

  const value = window.localStorage.getItem(STORAGE_KEY)
  return value === "dark" || value === "light" || value === "system"
    ? value
    : "system"
}

function applyTheme(theme: Theme) {
  const resolvedTheme = theme === "system" ? systemTheme() : theme
  document.documentElement.classList.toggle("dark", resolvedTheme === "dark")
  return resolvedTheme
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system")
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light")

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextTheme = storedTheme()
      setThemeState(nextTheme)
      setResolvedTheme(applyTheme(nextTheme))
    }, 0)

    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (theme !== "system") {
      return
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = () => setResolvedTheme(applyTheme("system"))
    media.addEventListener("change", handleChange)
    return () => media.removeEventListener("change", handleChange)
  }, [theme])

  const value = useMemo<ThemeContextValue>(
    () => ({
      resolvedTheme,
      setTheme(nextTheme) {
        window.localStorage.setItem(STORAGE_KEY, nextTheme)
        setThemeState(nextTheme)
        setResolvedTheme(applyTheme(nextTheme))
      },
      theme,
    }),
    [resolvedTheme, theme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useSiteTheme() {
  const value = useContext(ThemeContext)
  if (!value) {
    throw new Error("useSiteTheme must be used within ThemeProvider.")
  }

  return value
}
