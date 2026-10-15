"use client"

import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const BOOKING_STEPS = ["Date", "Duration", "Schedule", "Ideas", "Additional costs", "Video", "Review", "Payment"]

export function BookingStepper({ current, completed, onSelect }: {
  current: number
  completed: boolean[]
  onSelect: (step: number) => void
}) {
  return (
    <nav aria-label="Booking progress" className="rounded-2xl border border-ink/10 bg-card p-4 sm:p-6">
      <p className="mb-4 text-sm font-semibold sm:hidden">Step {current + 1} of {BOOKING_STEPS.length} · {BOOKING_STEPS[current]}</p>
      <ol className="flex items-start">
        {BOOKING_STEPS.map((name, index) => {
          const reachable = completed.slice(0, index).every(Boolean)
          const done = completed[index] && index !== current
          return (
            <li key={name} className="relative flex min-w-0 flex-1 flex-col items-center gap-2">
              {index < BOOKING_STEPS.length - 1 && <span aria-hidden="true" className={cn("absolute left-1/2 top-4 h-0.5 w-full", completed[index] ? "bg-jade" : "bg-ink/15")} />}
              <Button type="button" variant="default" size="icon" aria-label={`Step ${index + 1}: ${name}`} aria-current={index === current ? "step" : undefined}
                disabled={!reachable} onClick={() => onSelect(index)}
                className={cn("relative z-10 size-8 rounded-full border-2 disabled:opacity-100", done ? "border-jade bg-jade text-paper hover:bg-jade hover:text-paper" : index === current ? "border-jade bg-card text-jade hover:bg-card hover:text-jade" : "border-ink/20 bg-card text-ink/40 hover:bg-card hover:text-ink")}
              >{done ? <Check className="size-4" /> : <span>{index + 1}</span>}</Button>
              <span className={cn("hidden text-center text-xs sm:block", index === current ? "font-semibold text-ink" : "text-ink/50")}>{name}</span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
