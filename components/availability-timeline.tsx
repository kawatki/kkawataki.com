"use client"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

function minutes(time: string) {
  const [hour, minute] = time.split(":").map(Number)
  return hour * 60 + minute
}

function time(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`
}

const colors = {
  Available: "#BFD4CE",
  Unavailable: "color-mix(in srgb, var(--ink) 12%, transparent)",
  Selected: "#286557",
}

export function AvailabilityTimeline({ availableTimes, start, end, selectedStart, selectedEnd }: {
  availableTimes: string[]
  start: string
  end: string
  selectedStart: string
  selectedEnd: string
}) {
  const available = new Set(availableTimes)
  const first = minutes(start)
  const last = minutes(end)
  const cells = Array.from({ length: Math.ceil((last - first) / 60) }, (_, index) => {
    const from = first + index * 60
    const to = Math.min(from + 60, last)
    const parts = Array.from({ length: Math.ceil((to - from) / 30) }, (_, part) => {
      const minute = from + part * 30
      const state: keyof typeof colors = selectedStart && selectedEnd && minute >= minutes(selectedStart) && minute < minutes(selectedEnd)
        ? "Selected" : available.has(time(minute)) ? "Available" : "Unavailable"
      return { minute, state }
    })
    const sameState = parts.every((part) => part.state === parts[0].state)
    const label = sameState
      ? `${time(from)}–${time(to)} · ${parts[0].state}`
      : parts.map((part) => `${time(part.minute)}–${time(Math.min(part.minute + 30, to))} · ${part.state}`).join("; ")
    const background = sameState ? colors[parts[0].state] : `linear-gradient(to right, ${parts.map((part, index) => `${colors[part.state]} ${index / parts.length * 100}% ${(index + 1) / parts.length * 100}%`).join(", ")})`
    return { from, to, label, background }
  })
  const midpoint = Math.ceil(cells.length / 2)
  const rows = [cells.slice(0, midpoint), cells.slice(midpoint)].filter((row) => row.length)

  return (
    <section aria-label="Daily availability overview" className="mt-5 rounded-2xl border border-ink/10 bg-cream/60 p-4 sm:p-5">
      <h4 className="text-sm font-semibold">Your day at a glance</h4>
      <p className="mt-2 text-xs leading-5 text-ink/55">Each block shows one hour, in Japan time. Hover or focus for details. Split colors show a change within the hour.</p>
      <div className="mt-5 space-y-5">
        {rows.map((row) => (
          <div key={row[0].from}>
            <div className="mb-2 flex justify-between font-mono text-xs text-ink/50"><span>{time(row[0].from)}</span><span>{time(row[row.length - 1].to)}</span></div>
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>
              {row.map((cell) => (
                <Tooltip key={cell.from}>
                  <TooltipTrigger render={<span tabIndex={0} aria-label={cell.label} className="block h-12 cursor-help first:rounded-l-full last:rounded-r-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jade sm:h-14" style={{ background: cell.background }} />} />
                  <TooltipContent>{cell.label}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink/55">
        {(["Available", "Unavailable", "Selected"] as const).map((state) => <span key={state} className="inline-flex items-center gap-2"><span className="size-3 rounded-full" style={{ background: colors[state] }} />{state}</span>)}
      </div>
      <p className="mt-4 text-sm text-ink/60">{selectedStart && selectedEnd ? `${time(minutes(selectedStart))}–${time(minutes(selectedEnd))} selected.` : "Choose an experience and start time to highlight your booking."}</p>
    </section>
  )
}
