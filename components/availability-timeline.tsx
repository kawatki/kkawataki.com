"use client"

import { useEffect, useRef, type PointerEvent } from "react"
import { showError, dismissError } from "@/components/ui/toast"
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

export function AvailabilityTimeline({ availableTimes, start, end, selectedStart, selectedEnd, startOptions = [], onSelectStart, blockedReason, onBlockedSelection }: {
  availableTimes: string[]
  start: string
  end: string
  selectedStart: string
  selectedEnd: string
  onBlockedSelection?: () => void
  blockedReason?: string
  startOptions?: string[]
  onSelectStart?: (time: string) => void
}) {
  const notification = useRef<string | null>(null)
  useEffect(() => {
    return () => {
      if (notification.current) dismissError(notification.current)
      notification.current = null
    }
  }, [blockedReason])
  function reportBlockedSelection() {
    if (blockedReason) {
      notification.current = showError(blockedReason)
      onBlockedSelection?.()
    }
  }
  const gridRef = useRef<HTMLDivElement>(null)
  const drag = useRef<number | null>(null)
  const interactive = !!onSelectStart && startOptions.length > 0
  function selectAt(event: PointerEvent<HTMLDivElement>) {
    const rows = gridRef.current?.querySelectorAll<HTMLElement>("[data-time-row]")
    if (!rows || !interactive) return
    let bestRow: HTMLElement | undefined
    let distance = Infinity
    rows.forEach(row => {
      const rect = row.getBoundingClientRect()
      const gap = Math.max(rect.top - event.clientY, event.clientY - rect.bottom, 0)
      if (gap < distance) { bestRow = row; distance = gap }
    })
    if (!bestRow) return
    const rect = bestRow.getBoundingClientRect()
    const from = Number(bestRow.dataset.from)
    const to = Number(bestRow.dataset.to)
    const fraction = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
    const target = from + Math.floor(fraction * (to - from) / 30) * 30
    const nearest = startOptions.reduce((best, option) =>
      Math.abs(minutes(option) - target) < Math.abs(minutes(best) - target) ? option : best)
    onSelectStart?.(nearest)
  }
  const available = new Set(availableTimes)
  const first = minutes(start)
  const last = minutes(end)
  const cells = Array.from({ length: Math.ceil((last - first) / 30) }, (_, index) => {
    const from = first + index * 30
    const to = Math.min(from + 30, last)
    const state: keyof typeof colors = selectedStart && selectedEnd && from >= minutes(selectedStart) && from < minutes(selectedEnd)
      ? "Selected" : available.has(time(from)) ? "Available" : "Unavailable"
    return { from, to, label: `${time(from)}–${time(to)} · ${state}`, background: colors[state] }
  })
  const midpoint = Math.ceil(cells.length / 2)
  const rows = [cells.slice(0, midpoint), cells.slice(midpoint)].filter((row) => row.length)

  return (
    <section aria-label="Daily availability overview" className="mt-5 rounded-2xl border border-ink/10 bg-cream/60 p-4 sm:p-5">
      <h4 className="text-sm font-semibold">Your day at a glance</h4>
      <p className="mt-2 text-xs leading-5 text-ink/55">{interactive ? "Click or tap a time, or press and drag along the bars to move your booking. Selection snaps to an available start; your plan’s duration stays fixed." : "Choose a duration above to select a start time here."} Each block shows 30 minutes in Japan time.</p>
      <div ref={gridRef} className={`mt-5 space-y-5 ${interactive ? "touch-none select-none" : ""}`}
        onClick={event => {
          if (blockedReason && (event.target as HTMLElement).closest("[data-time-row]")) reportBlockedSelection()
        }}
        onPointerDown={event => {
          if (!interactive || event.button !== 0 || !event.isPrimary) return
          if (!(event.target as HTMLElement).closest("[data-time-row]")) return
          event.preventDefault()
          drag.current = event.pointerId
          event.currentTarget.setPointerCapture(event.pointerId)
          selectAt(event)
        }}
        onPointerMove={event => { if (drag.current === event.pointerId) selectAt(event) }}
        onPointerUp={event => {
          if (drag.current !== event.pointerId) return
          selectAt(event)
          drag.current = null
          event.currentTarget.releasePointerCapture(event.pointerId)
        }}
        onPointerCancel={() => { drag.current = null }}
        onLostPointerCapture={() => { drag.current = null }}
      >
        {rows.map((row) => (
          <div key={row[0].from}>
            <div className="mb-2 flex justify-between font-mono text-xs text-ink/50"><span>{time(row[0].from)}</span><span>{time(row[row.length - 1].to)}</span></div>
            <div data-time-row data-from={row[0].from} data-to={row[row.length - 1].to} className="grid gap-1" style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>
              {row.map((cell) => (
                <Tooltip key={cell.from}>
                  <TooltipTrigger render={<span tabIndex={interactive || blockedReason ? 0 : -1} role={interactive || blockedReason ? "button" : undefined} aria-label={interactive ? `${cell.label}. Select nearest available start.` : cell.label}
                    onKeyDown={event => {
                      if (blockedReason && ["Enter", " "].includes(event.key)) {
                        event.preventDefault()
                        reportBlockedSelection()
                        return
                      }
                      if (!interactive || !["Enter", " ", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return
                      event.preventDefault()
                      const index = Math.max(0, startOptions.indexOf(selectedStart))
                      const value = event.key === "Home" ? startOptions[0] : event.key === "End" ? startOptions.at(-1)! : event.key === "ArrowLeft" ? startOptions[Math.max(0, index - 1)] : event.key === "ArrowRight" ? startOptions[Math.min(startOptions.length - 1, index + 1)] : startOptions.reduce((best, option) => Math.abs(minutes(option) - cell.from) < Math.abs(minutes(best) - cell.from) ? option : best)
                      onSelectStart?.(value)
                    }} className="block h-12 cursor-pointer first:rounded-l-full last:rounded-r-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jade sm:h-14" style={{ background: cell.background }} />} />
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
      <p role="status" aria-live="polite" className="mt-4 font-bold text-xl text-ink/80">{selectedStart && selectedEnd ? `${time(minutes(selectedStart))}–${time(minutes(selectedEnd))} selected.` : "Choose an experience and start time to highlight your booking."}</p>
    </section>
  )
}
