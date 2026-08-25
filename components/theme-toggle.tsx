"use client"

import { Moon, Sun } from "lucide-react"

import { useSiteTheme } from "@/components/theme-provider"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useSiteTheme()

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label="Toggle color theme"
            onClick={() =>
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
            className="flex size-10 items-center justify-center rounded-full border border-ink/15 bg-card/70 text-ink transition hover:border-ink/30 hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vermilion"
          />
        }
      >
        <Sun className="hidden size-4.5 dark:block" aria-hidden="true" />
        <Moon className="size-4.5 dark:hidden" aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>Toggle color theme</TooltipContent>
    </Tooltip>
  )
}
