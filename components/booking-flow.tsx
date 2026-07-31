"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { AlertDialog } from "@base-ui/react/alert-dialog"
import { Checkbox } from "@base-ui/react/checkbox"
import { toast } from "sonner"
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  ShieldAlert,
  X,
} from "lucide-react"

import type { BookingPricing, MessagingPlatform } from "@/lib/booking"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { TurnstileWidget } from "@/components/turnstile-widget"

type AvailabilityDay = {
  availableTimes: string[]
  date: string
  totalSegments: number
}

type AvailabilityResponse = {
  dayHours?: {
    end: string
    start: string
  }
  days?: AvailabilityDay[]
  error?: string
  pricing?: BookingPricing
  transportBufferMinutes?: number
}

type CustomerMessagingPlatform = Exclude<MessagingPlatform, "none">

const MESSAGING_FIELDS: Record<
  CustomerMessagingPlatform,
  {
    inputMode?: "tel" | "text"
    label: string
    maxLength: number
    pattern: string
    placeholder: string
    prefix?: string
  }
> = {
  discord: {
    label: "Discord username",
    maxLength: 33,
    pattern: "@?[A-Za-z0-9._]{2,32}",
    placeholder: "username",
    prefix: "@",
  },
  instagram: {
    label: "Instagram username",
    maxLength: 31,
    pattern: "@?[A-Za-z0-9._]{1,30}",
    placeholder: "username",
    prefix: "@",
  },
  line: {
    label: "LINE ID",
    maxLength: 80,
    pattern: "[A-Za-z0-9._-]{1,80}",
    placeholder: "your-line-id",
  },
  whatsapp: {
    inputMode: "tel",
    label: "WhatsApp phone number",
    maxLength: 30,
    pattern: "\\+?[0-9 ()-]{7,30}",
    placeholder: "+81 90 1234 5678",
  },
  x: {
    label: "X username",
    maxLength: 16,
    pattern: "@?[A-Za-z0-9_]{1,15}",
    placeholder: "username",
    prefix: "@",
  },
}

const MESSAGING_OPTIONS: Array<{
  label: string
  value: CustomerMessagingPlatform
}> = [
  { label: "Instagram", value: "instagram" },
  { label: "X", value: "x" },
  { label: "LINE", value: "line" },
  { label: "WhatsApp", value: "whatsapp" },
  { label: "Discord", value: "discord" },
]

function yen(amount: number) {
  return `¥${amount.toLocaleString("en-US")}`
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

function minutesToTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(
    minutes % 60
  ).padStart(2, "0")}`
}

function displayTime(time: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(new Date(`2026-01-01T${time}:00+09:00`))
}

function endOptions(
  day: AvailabilityDay,
  startTime: string,
  pricing: BookingPricing
) {
  if (!startTime) return []

  const available = new Set(day.availableTimes)
  const start = timeToMinutes(startTime)
  const options: string[] = []

  for (
    let end = start + pricing.bookingIncrementMinutes;
    available.has(minutesToTime(end - pricing.bookingIncrementMinutes));
    end += pricing.bookingIncrementMinutes
  ) {
    if (end - start >= pricing.minimumDurationMinutes) {
      options.push(minutesToTime(end))
    }
  }
  return options
}

function startOptions(day: AvailabilityDay, pricing: BookingPricing) {
  return day.availableTimes.filter(
    (startTime) => endOptions(day, startTime, pricing).length > 0
  )
}

function timelineTimes(
  startTime: string,
  endTime: string,
  incrementMinutes: number
) {
  const times: string[] = []
  for (
    let minute = timeToMinutes(startTime);
    minute < timeToMinutes(endTime);
    minute += incrementMinutes
  ) {
    times.push(minutesToTime(minute))
  }
  return times
}

function displayDate(date: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Tokyo",
    ...options,
  }).format(new Date(`${date}T12:00:00+09:00`))
}

function monthLabel(month: string) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    timeZone: "Asia/Tokyo",
    year: "numeric",
  }).format(new Date(`${month}-01T12:00:00+09:00`))
}

function calendarDates(month: string) {
  const [year, monthNumber] = month.split("-").map(Number)
  const firstWeekday = new Date(
    Date.UTC(year, monthNumber - 1, 1)
  ).getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  const dates: Array<string | null> = Array.from(
    { length: firstWeekday },
    () => null
  )

  for (let day = 1; day <= daysInMonth; day += 1) {
    dates.push(
      `${month}-${String(day).padStart(2, "0")}`
    )
  }
  return dates
}

function dayAvailability(day: AvailabilityDay, pricing: BookingPricing) {
  const minimumSegments =
    pricing.minimumDurationMinutes / pricing.bookingIncrementMinutes
  const maximumStarts = Math.max(day.totalSegments - minimumSegments + 1, 0)
  const availableStarts = startOptions(day, pricing).length

  if (!availableStarts || !maximumStarts) {
    return {
      className: "border-ink/5 bg-ink/[0.08] text-ink/30",
      label: "Unavailable",
    }
  }

  const remainingRatio = availableStarts / maximumStarts
  if (remainingRatio > 0.66) {
    return {
      className:
        "border-[#286557] bg-[#286557] text-white hover:bg-[#22584C]",
      label: "Plenty of times",
    }
  }
  if (remainingRatio > 0.33) {
    return {
      className:
        "border-[#76A99B] bg-[#79AA9C] text-white hover:bg-[#699C8E]",
      label: "Filling up",
    }
  }
  return {
    className:
      "border-[#B8D5CD] bg-[#DCEBE7] text-[#214E43] hover:bg-[#D1E4DF]",
    label: "Limited times",
  }
}

function StepLabel({
  children,
  inverted = false,
  step,
}: {
  children: React.ReactNode
  inverted?: boolean
  step: number
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full border font-display text-base leading-none shadow-sm",
          inverted
            ? "border-paper/20 bg-paper text-ink"
            : "border-ink/10 bg-ink text-paper"
        )}
      >
        {step}
      </span>
      <p className={cn("eyebrow", inverted && "text-paper/50")}>{children}</p>
    </div>
  )
}

export function BookingFlow({
  paymentCancelled = false,
  turnstileSiteKey,
}: {
  paymentCancelled?: boolean
  turnstileSiteKey: string
}) {
  const [days, setDays] = useState<AvailabilityDay[]>([])
  const [visibleMonth, setVisibleMonth] = useState("")
  const [selectedDate, setSelectedDate] = useState("")
  const [selectedStart, setSelectedStart] = useState("")
  const [selectedEnd, setSelectedEnd] = useState("")
  const [dayHours, setDayHours] = useState({
    end: "23:00",
    start: "09:00",
  })
  const [pricing, setPricing] = useState<BookingPricing | null>(null)
  const [transportBufferMinutes, setTransportBufferMinutes] = useState(60)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [checkoutError, setCheckoutError] = useState("")
  const [confirmationOpen, setConfirmationOpen] = useState(false)
  const [depositTermsAccepted, setDepositTermsAccepted] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState("")
  const [turnstileAttempt, setTurnstileAttempt] = useState(0)
  const [socialPlatform, setSocialPlatform] =
    useState<CustomerMessagingPlatform>("instagram")
  const messagingField = MESSAGING_FIELDS[socialPlatform]
  const [guidedStep, setGuidedStep] = useState<1 | 2 | 3 | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const calendarSectionRef = useRef<HTMLElement>(null)
  const timeSectionRef = useRef<HTMLDivElement>(null)
  const guideInitialDoneRef = useRef(false)
  const guideDateDoneRef = useRef(false)
  const guideFormDoneRef = useRef(false)
  const guideHighlightTimerRef = useRef<number | null>(null)
  const handleTurnstileToken = useCallback((token: string) => {
    setTurnstileToken(token)
  }, [])

  function guideToStep(
    step: 1 | 2 | 3,
    target: React.RefObject<HTMLElement | null>
  ) {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        target.current?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "auto"
            : "smooth",
          block: "start",
        })
        setGuidedStep(step)
        if (guideHighlightTimerRef.current !== null) {
          window.clearTimeout(guideHighlightTimerRef.current)
        }
        guideHighlightTimerRef.current = window.setTimeout(() => {
          setGuidedStep(null)
          guideHighlightTimerRef.current = null
        }, 1900)
      })
    })
  }

  async function loadAvailability() {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/availability", { cache: "no-store" })
      const result = (await response.json()) as AvailabilityResponse
      if (
        !response.ok ||
        !result.dayHours ||
        !result.days ||
        !result.pricing
      ) {
        throw new Error(result.error ?? "Available times could not be loaded.")
      }

      setDays(result.days)
      setDayHours(result.dayHours)
      setPricing(result.pricing)
      setTransportBufferMinutes(result.transportBufferMinutes ?? 60)
      setSelectedStart("")
      setSelectedEnd("")
      const firstAvailable = result.days.find(
        (day) => startOptions(day, result.pricing!).length
      )
      setSelectedDate((current) =>
        !current
          ? (firstAvailable?.date ?? "")
          : result.days?.some(
                (day) =>
                  day.date === current &&
                  startOptions(day, result.pricing!).length
              )
            ? current
            : ""
      )
      const availableMonths = Array.from(
        new Set(result.days.map((day) => day.date.slice(0, 7)))
      )
      setVisibleMonth((current) =>
        availableMonths.includes(current)
          ? current
          : (firstAvailable?.date.slice(0, 7) ?? availableMonths[0] ?? "")
      )
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          calendarSectionRef.current?.scrollIntoView({
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
              .matches
              ? "auto"
              : "smooth",
            block: "start",
          })
          if (!guideInitialDoneRef.current) {
            guideInitialDoneRef.current = true
            setGuidedStep(1)
            if (guideHighlightTimerRef.current !== null) {
              window.clearTimeout(guideHighlightTimerRef.current)
            }
            guideHighlightTimerRef.current = window.setTimeout(() => {
              setGuidedStep(null)
              guideHighlightTimerRef.current = null
            }, 1900)
          }
        })
      })
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Available times could not be loaded."
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadAvailability(), 0)
    return () => {
      window.clearTimeout(timeout)
      if (guideHighlightTimerRef.current !== null) {
        window.clearTimeout(guideHighlightTimerRef.current)
      }
    }
  }, [])

  const activeDay = useMemo(
    () => days.find((day) => day.date === selectedDate),
    [days, selectedDate]
  )
  const months = useMemo(
    () => Array.from(new Set(days.map((day) => day.date.slice(0, 7)))),
    [days]
  )
  const visibleMonthIndex = months.indexOf(visibleMonth)
  const daysByDate = useMemo(
    () => new Map(days.map((day) => [day.date, day])),
    [days]
  )
  const monthDates = useMemo(
    () => (visibleMonth ? calendarDates(visibleMonth) : []),
    [visibleMonth]
  )
  const activeStartOptions =
    activeDay && pricing ? startOptions(activeDay, pricing) : []
  const activeEndOptions =
    activeDay && pricing
      ? endOptions(activeDay, selectedStart, pricing)
      : []
  const activeTimelineTimes = useMemo(
    () =>
      pricing
        ? timelineTimes(
            dayHours.start,
            dayHours.end,
            pricing.bookingIncrementMinutes
          )
        : [],
    [dayHours.end, dayHours.start, pricing]
  )
  const timelineRows = useMemo(() => {
    const midpoint = Math.ceil(activeTimelineTimes.length / 2)
    return [
      activeTimelineTimes.slice(0, midpoint),
      activeTimelineTimes.slice(midpoint),
    ].filter((row) => row.length)
  }, [activeTimelineTimes])
  const selectedPricing = useMemo(() => {
    if (!pricing || !selectedStart || !selectedEnd) return null

    const durationMinutes =
      timeToMinutes(selectedEnd) - timeToMinutes(selectedStart)
    if (durationMinutes < pricing.minimumDurationMinutes) return null

    const serviceTotalJpy =
      pricing.rateJpyPer30Minutes *
      (durationMinutes / pricing.bookingIncrementMinutes)
    const depositAmountJpy = Math.ceil(
      (serviceTotalJpy * pricing.depositPercent) / 100
    )
    return {
      ...pricing,
      balanceDueJpy: serviceTotalJpy - depositAmountJpy,
      depositAmountJpy,
      durationHours: durationMinutes / 60,
      serviceTotalJpy,
    }
  }, [pricing, selectedEnd, selectedStart])

  useEffect(() => {
    if (selectedPricing) {
      toast.dismiss("minimum-booking-duration")
      if (!guideFormDoneRef.current) {
        guideFormDoneRef.current = true
        guideToStep(3, formRef)
      }
    }
  }, [selectedPricing])

  function navigateMonth(direction: -1 | 1) {
    const nextMonth = months[visibleMonthIndex + direction]
    if (!nextMonth) return

    setVisibleMonth(nextMonth)
    setSelectedDate(
      days.find(
        (day) =>
          day.date.startsWith(nextMonth) &&
          pricing &&
          startOptions(day, pricing).length
      )?.date ?? ""
    )
    setSelectedStart("")
    setSelectedEnd("")
  }

  function selectTimelineTime(time: string) {
    if (!activeDay || !pricing) return

    const canStart = activeStartOptions.includes(time)
    if (!selectedStart || selectedEnd) {
      if (canStart) {
        setSelectedStart(time)
        setSelectedEnd("")
      }
      return
    }

    const endTime = minutesToTime(
      timeToMinutes(time) + pricing.bookingIncrementMinutes
    )
    const attemptedDuration =
      timeToMinutes(endTime) - timeToMinutes(selectedStart)

    if (
      attemptedDuration > 0 &&
      attemptedDuration < pricing.minimumDurationMinutes
    ) {
      toast.error("Choose at least 4 hours", {
        id: "minimum-booking-duration",
        description: `Your end time must be at least ${pricing.minimumDurationMinutes / 60} hours after ${displayTime(selectedStart)}.`,
        duration: 3500,
      })
      return
    }

    if (activeEndOptions.includes(endTime)) {
      setSelectedEnd(endTime)
    } else if (canStart) {
      setSelectedStart(time)
      setSelectedEnd("")
    }
  }

  function requestCheckout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCheckoutError("")
    setDepositTermsAccepted(false)
    setTurnstileToken("")
    setTurnstileAttempt((attempt) => attempt + 1)
    setConfirmationOpen(true)
  }

  async function startCheckout() {
    if (
      !depositTermsAccepted ||
      !formRef.current ||
      !selectedPricing ||
      !turnstileToken
    ) return

    setError("")
    setSubmitting(true)

    const form = new FormData(formRef.current)
    let shouldRefreshAvailability = false
    try {
      const response = await fetch("/api/checkout/", {
        body: JSON.stringify({
          depositTermsAccepted: true,
          email: form.get("email"),
          endTime: selectedEnd,
          name: form.get("name"),
          notes: form.get("notes"),
          socialHandle: form.get("socialHandle"),
          socialPlatform,
          date: selectedDate,
          startTime: selectedStart,
          title: form.get("title"),
          turnstileToken,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
      const result = (await response.json()) as { error?: string; url?: string }
      if (!response.ok || !result.url) {
        shouldRefreshAvailability = response.status === 409
        throw new Error(result.error ?? "Checkout could not be started.")
      }
      window.location.assign(result.url)
    } catch (checkoutError) {
      const message =
        checkoutError instanceof Error
          ? checkoutError.message
          : "Checkout could not be started."

      if (shouldRefreshAvailability) {
        setSelectedStart("")
        setSelectedEnd("")
        await loadAvailability()
      }

      setError(message)
      setCheckoutError(
        shouldRefreshAvailability
          ? `${message} Close this notice and choose another time.`
          : message
      )
      setTurnstileToken("")
      setTurnstileAttempt((attempt) => attempt + 1)
      setSubmitting(false)
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
      <section
        ref={calendarSectionRef}
        className={cn(
          "scroll-mt-24 rounded-3xl border border-ink/10 bg-card p-5 shadow-xl shadow-black/10 sm:p-7",
          guidedStep === 1 && "booking-guide-pulse"
        )}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <StepLabel step={1}>Pick a date</StepLabel>
            <h2 className="mt-2 font-display text-3xl">Available in Tokyo</h2>
          </div>
          <button
            type="button"
            onClick={() => void loadAvailability()}
            disabled={loading}
            className="flex size-10 items-center justify-center rounded-full border border-ink/15 text-ink/60 transition hover:bg-cream disabled:opacity-50"
            aria-label="Refresh available times"
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          </button>
        </div>

        {paymentCancelled && (
          <p className="mt-5 rounded-xl bg-cream px-4 py-3 text-sm text-ink/70">
            Payment was cancelled. Your card was not charged; you can choose a
            time again whenever you are ready.
          </p>
        )}

        {loading ? (
          <div className="flex min-h-72 items-center justify-center text-ink/50">
            <LoaderCircle className="mr-2 size-5 animate-spin" />
            Loading live availability…
          </div>
        ) : days.length ? (
          <>
            <div className="mt-7 flex items-center justify-between rounded-2xl bg-cream/70 p-2">
              <button
                type="button"
                onClick={() => navigateMonth(-1)}
                disabled={visibleMonthIndex <= 0}
                className="flex size-10 items-center justify-center rounded-xl text-ink/60 transition hover:bg-cream hover:text-ink disabled:pointer-events-none disabled:opacity-20"
                aria-label="Previous month"
              >
                <ChevronLeft className="size-5" />
              </button>
              <h3 className="font-display text-2xl" aria-live="polite">
                {monthLabel(visibleMonth)}
              </h3>
              <button
                type="button"
                onClick={() => navigateMonth(1)}
                disabled={visibleMonthIndex === months.length - 1}
                className="flex size-10 items-center justify-center rounded-xl text-ink/60 transition hover:bg-cream hover:text-ink disabled:pointer-events-none disabled:opacity-20"
                aria-label="Next month"
              >
                <ChevronRight className="size-5" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-7 gap-2 text-center text-[0.65rem] font-semibold uppercase tracking-wider text-ink/40">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-7 gap-2">
              {monthDates.map((date, index) => {
                if (!date) {
                  return <span key={`empty-${index}`} aria-hidden="true" />
                }

                const day = daysByDate.get(date)
                if (!day) {
                  return (
                    <Tooltip key={date}>
                      <TooltipTrigger
                        render={
                          <span className="flex aspect-square items-center justify-center rounded-lg border border-ink/5 bg-ink/[0.025] text-sm font-semibold text-ink/20" />
                        }
                      >
                        {Number(date.slice(-2))}
                      </TooltipTrigger>
                      <TooltipContent>
                        {displayDate(date, { dateStyle: "long" })} · Not
                        bookable
                      </TooltipContent>
                    </Tooltip>
                  )
                }

                const availability = pricing
                  ? dayAvailability(day, pricing)
                  : {
                      className:
                        "border-ink/5 bg-ink/[0.08] text-ink/30",
                      label: "Unavailable",
                    }
                const available =
                  pricing ? startOptions(day, pricing).length : 0
                const selected = selectedDate === day.date
                return (
                  <Tooltip key={day.date}>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          aria-disabled={!available}
                          onClick={() => {
                            if (!available) return
                            setSelectedDate(day.date)
                            setSelectedStart("")
                            setSelectedEnd("")
                            if (!guideDateDoneRef.current) {
                              guideDateDoneRef.current = true
                              guideToStep(2, timeSectionRef)
                            }
                          }}
                          className={cn(
                            "aspect-square rounded-lg border text-sm font-semibold transition",
                            availability.className,
                            available === 0 && "cursor-not-allowed",
                            selected && "ring-2 ring-vermilion ring-offset-2"
                          )}
                        />
                      }
                    >
                      {Number(day.date.slice(-2))}
                    </TooltipTrigger>
                    <TooltipContent>
                      {displayDate(day.date, { dateStyle: "long" })} ·{" "}
                      {availability.label}
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink/45">
              <span className="inline-flex items-center gap-2">
                <span className="size-3 rounded-sm bg-[#286557]" /> Plenty
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="size-3 rounded-sm bg-[#79AA9C]" /> Filling up
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="size-3 rounded-sm bg-[#DCEBE7]" /> Limited
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="size-3 rounded-sm bg-ink/[0.08]" /> Unavailable
              </span>
              <span>Times shown in Japan Standard Time</span>
            </div>

            {activeDay && (
              <div
                ref={timeSectionRef}
                className={cn(
                  "scroll-mt-24 mt-8 rounded-2xl border-t border-ink/10 pt-6",
                  guidedStep === 2 && "booking-guide-pulse"
                )}
              >
                <StepLabel step={2}>Choose your time range</StepLabel>
                <h3 className="mt-2 font-display text-2xl">
                  {displayDate(activeDay.date, {
                    day: "numeric",
                    month: "long",
                    weekday: "long",
                  })}
                </h3>
                <p className="mt-2 text-sm leading-6 text-ink/55">
                  Tap an available start, then tap your end time. Times are
                  offered in 30-minute increments. A{" "}
                  {transportBufferMinutes / 60}-hour transportation buffer is
                  automatically kept after every booking.
                </p>

                <div className="mt-5 rounded-2xl border border-ink/10 bg-cream/60 p-4 sm:p-5">
                  <div className="space-y-5">
                    {timelineRows.map((row) => {
                      const rowEnd = minutesToTime(
                        timeToMinutes(row.at(-1) ?? dayHours.end) +
                          (pricing?.bookingIncrementMinutes ?? 30)
                      )
                      return (
                        <div key={row[0]}>
                          <div className="mb-2 flex items-center justify-between font-mono text-[0.7rem] text-ink/50">
                            <span>{row[0]}</span>
                            <span>{rowEnd}</span>
                          </div>
                          <div
                            className="grid gap-0.5"
                            style={{
                              gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))`,
                            }}
                          >
                            {row.map((time, index) => {
                              const available =
                                activeDay.availableTimes.includes(time)
                              const segmentStart = timeToMinutes(time)
                              const selectionStart = selectedStart
                                ? timeToMinutes(selectedStart)
                                : Number.NaN
                              const selectionEnd = selectedEnd
                                ? timeToMinutes(selectedEnd)
                                : selectionStart +
                                  (pricing?.bookingIncrementMinutes ?? 30)
                              const selected =
                                Boolean(selectedStart) &&
                                segmentStart >= selectionStart &&
                                segmentStart < selectionEnd
                              const segmentEnd = minutesToTime(
                                segmentStart +
                                  (pricing?.bookingIncrementMinutes ?? 30)
                              )

                              return (
                                <Tooltip key={time}>
                                  <TooltipTrigger
                                    render={
                                      <button
                                        type="button"
                                        aria-disabled={!available}
                                        onClick={() => {
                                          if (!available) return
                                          selectTimelineTime(time)
                                        }}
                                        aria-pressed={selected}
                                        aria-label={`${displayTime(
                                          time
                                        )} to ${displayTime(segmentEnd)}: ${
                                          available
                                            ? "available"
                                            : "unavailable"
                                        }${selected ? ", selected" : ""}`}
                                        className={cn(
                                          "relative h-11 transition first:rounded-l-xl last:rounded-r-xl focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                                          !available &&
                                            "cursor-not-allowed bg-ink/[0.12]",
                                          available &&
                                            !selected &&
                                            "bg-[#BFD4CE] hover:bg-[#ABC8C0]",
                                          available &&
                                            selected &&
                                            "bg-[#286557] hover:bg-[#22584C]",
                                          index === 0 && "rounded-l-xl",
                                          index === row.length - 1 &&
                                            "rounded-r-xl"
                                        )}
                                      />
                                    }
                                  />
                                  <TooltipContent>
                                    {displayTime(time)}–{displayTime(segmentEnd)}{" "}
                                    ·{" "}
                                    {selected
                                      ? "Selected"
                                      : available
                                        ? "Available"
                                        : "Unavailable"}
                                  </TooltipContent>
                                </Tooltip>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink/50">
                    <span className="inline-flex items-center gap-2">
                      <span className="size-3 rounded-sm bg-[#BFD4CE]" />
                      Available
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span className="size-3 rounded-sm bg-ink/[0.12]" />
                      Unavailable
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span className="size-3 rounded-sm bg-[#286557]" />
                      Selected
                    </span>
                  </div>

                  <p
                    className="mt-4 text-sm font-medium text-ink/70"
                    aria-live="polite"
                  >
                    {!selectedStart
                      ? "Choose your start time."
                      : !selectedEnd
                        ? `Starts at ${displayTime(
                            selectedStart
                          )}. Now choose an end time at least four hours later.`
                        : `${displayTime(selectedStart)}–${displayTime(
                            selectedEnd
                          )} selected. Tap another available time to start again.`}
                  </p>
                </div>

                <p className="mt-5 text-xs font-semibold uppercase tracking-[0.12em] text-ink/40">
                  Fine-tune exact times
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">
                    Start
                    <span className="relative">
                      <Clock3 className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink/45" />
                      <select
                        value={selectedStart}
                        onChange={(event) => {
                          const nextStart = event.target.value
                          setSelectedStart(nextStart)
                          setSelectedEnd(
                            nextStart && pricing
                              ? (endOptions(
                                  activeDay,
                                  nextStart,
                                  pricing
                                )[0] ?? "")
                              : ""
                          )
                        }}
                        className="h-13 w-full appearance-none rounded-xl border border-ink/15 bg-paper pl-11 pr-4 text-sm font-semibold text-ink outline-none transition focus:border-jade"
                      >
                        <option value="">Select start</option>
                        {activeStartOptions.map((time) => (
                          <option key={time} value={time}>
                            {displayTime(time)}
                          </option>
                        ))}
                      </select>
                    </span>
                  </label>
                  <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">
                    End
                    <span className="relative">
                      <Clock3 className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink/45" />
                      <select
                        value={selectedEnd}
                        onChange={(event) => setSelectedEnd(event.target.value)}
                        disabled={!selectedStart}
                        className="h-13 w-full appearance-none rounded-xl border border-ink/15 bg-paper pl-11 pr-4 text-sm font-semibold text-ink outline-none transition focus:border-jade disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <option value="">Select end</option>
                        {activeEndOptions.map((time) => (
                          <option key={time} value={time}>
                            {displayTime(time)}
                          </option>
                        ))}
                      </select>
                    </span>
                  </label>
                </div>
                {selectedPricing && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-cream px-4 py-3 text-sm">
                    <span className="text-ink/60">
                      {selectedPricing.durationHours} hours ·{" "}
                      {yen(selectedPricing.serviceTotalJpy)} total
                    </span>
                    <span className="font-semibold text-vermilion">
                      {yen(selectedPricing.depositAmountJpy)} deposit
                    </span>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex min-h-72 flex-col items-center justify-center text-center">
            <CalendarDays className="size-8 text-ink/30" />
            <p className="mt-4 max-w-sm text-sm leading-6 text-ink/55">
              {error || "No online times are available right now."}
            </p>
          </div>
        )}
      </section>

      <form
        ref={formRef}
        onSubmit={requestCheckout}
        className={cn(
          "scroll-mt-24 rounded-3xl bg-ink p-6 text-paper shadow-2xl shadow-ink/15 sm:p-8",
          guidedStep === 3 && "booking-guide-pulse booking-guide-pulse-dark"
        )}
      >
        <StepLabel step={3} inverted>
          Tell me your plan
        </StepLabel>
        <h2 className="mt-3 font-display text-4xl">Secure your time.</h2>
        <p className="mt-3 text-sm leading-6 text-paper/60">
          Your slot is confirmed only after Stripe accepts the 25% deposit.
          The exact amount updates with the time range you choose.
        </p>

        <div className="mt-7 grid gap-5">
          <label className="grid gap-2 text-sm font-semibold">
            Name (Nickname)
            <input
              name="name"
              required
              maxLength={80}
              autoComplete="name"
              className="h-12 rounded-xl border border-paper/15 bg-paper/10 px-4 font-normal text-paper outline-none placeholder:text-paper/30 focus:border-jade-light"
              placeholder="Keisuke or Taki"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Email
            <input
              name="email"
              required
              type="email"
              maxLength={254}
              autoComplete="email"
              className="h-12 rounded-xl border border-paper/15 bg-paper/10 px-4 font-normal text-paper outline-none placeholder:text-paper/30 focus:border-jade-light"
              placeholder="you@example.com"
            />
          </label>
          <fieldset className="grid gap-3">
            <legend className="text-sm font-semibold">
              Where should I message you?
            </legend>
            <p className="text-xs leading-5 text-paper/50">
              <b>Required</b>—I’ll use this to discuss what you’d like to do
              before we meet and to communicate in real time on the day, such
              as when we’re finding each other.
            </p>

            <label className="grid gap-2 text-sm font-semibold">
              <span className="flex items-center gap-2">
                Messaging app
                <span className="rounded-full bg-[#DCEBE7] px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-[#214E43]">
                  Required
                </span>
              </span>
              <span className="relative">
                <select
                  value={socialPlatform}
                  onChange={(event) =>
                    setSocialPlatform(
                      event.target.value as CustomerMessagingPlatform
                    )
                  }
                  className="h-12 w-full appearance-none rounded-xl border border-[#76A99B] bg-paper/10 px-4 pr-11 font-normal text-paper outline-none transition focus:border-[#286557] focus:ring-2 focus:ring-[#79AA9C]/30 disabled:cursor-not-allowed"
                >
                  {MESSAGING_OPTIONS.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      className="bg-ink text-paper"
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  aria-hidden="true"
                  className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-paper/55"
                />
              </span>
            </label>

            <label className="grid gap-2 text-sm font-semibold">
              {messagingField.label}
              <span className="flex h-12 items-center rounded-xl border border-paper/15 bg-paper/10 px-4 transition-colors focus-within:border-[#76A99B]">
                {messagingField.prefix && (
                  <span
                    aria-hidden="true"
                    className="font-normal text-paper/55"
                  >
                    {messagingField.prefix}
                  </span>
                )}
                <input
                  name="socialHandle"
                  required
                  minLength={1}
                  maxLength={messagingField.maxLength}
                  pattern={messagingField.pattern}
                  inputMode={messagingField.inputMode ?? "text"}
                  autoComplete="off"
                  className={cn(
                    "min-w-0 flex-1 bg-transparent font-normal text-paper outline-none placeholder:text-paper/30 disabled:cursor-not-allowed",
                    messagingField.prefix && "pl-0.5"
                  )}
                  placeholder={messagingField.placeholder}
                />
              </span>
            </label>
          </fieldset>
          <label className="grid gap-2 text-sm font-semibold">
            What would you like to do?
            <input
              name="title"
              required
              minLength={3}
              maxLength={100}
              className="h-12 rounded-xl border border-paper/15 bg-paper/10 px-4 font-normal text-paper outline-none placeholder:text-paper/30 focus:border-jade-light"
              placeholder="Explore record shops in Shimokitazawa"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Anything else? <span className="font-normal text-paper/40">Optional</span>
            <textarea
              name="notes"
              maxLength={450}
              rows={4}
              className="resize-y rounded-xl border border-paper/15 bg-paper/10 px-4 py-3 font-normal text-paper outline-none placeholder:text-paper/30 focus:border-jade-light"
              placeholder="Interests, accessibility needs, where you are staying…"
            />
          </label>
        </div>

        {error && days.length > 0 && (
          <p role="alert" className="mt-5 rounded-xl bg-vermilion/20 px-4 py-3 text-sm">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!selectedPricing || submitting || loading}
          className="mt-7 flex h-13 w-full items-center justify-center gap-2 rounded-full bg-vermilion px-6 font-semibold text-white transition hover:bg-vermilion/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? (
            <>
              <LoaderCircle className="size-4 animate-spin" />
              Opening secure checkout…
            </>
          ) : (
            <>
              {selectedPricing
                ? `Pay ${yen(selectedPricing.depositAmountJpy)} deposit`
                : "Choose a time range"}
              <ArrowRight className="size-4" />
            </>
          )}
        </button>

        <p className="mt-4 flex items-center justify-center gap-2 text-xs text-paper/45">
          <LockKeyhole className="size-3.5" />
          Card details are handled securely by Stripe
        </p>

        <AlertDialog.Root
          open={confirmationOpen}
          onOpenChange={(open) => {
            if (!submitting) {
              setConfirmationOpen(open)
              if (!open) {
                setCheckoutError("")
                setDepositTermsAccepted(false)
                setTurnstileToken("")
              }
            }
          }}
        >
          <AlertDialog.Portal>
            <AlertDialog.Backdrop className="fixed inset-0 z-[100] bg-ink/70 backdrop-blur-sm data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity" />
            <AlertDialog.Viewport className="fixed inset-0 z-[101] flex items-center justify-center overflow-y-auto overscroll-contain p-4 sm:p-8">
              <AlertDialog.Popup className="booking-dialog-scrollbar relative max-h-[calc(100dvh-2rem)] w-full max-w-lg touch-pan-y overflow-y-auto overscroll-contain rounded-3xl border border-ink/10 bg-paper p-6 text-ink shadow-2xl outline-none data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 transition-[transform,opacity] sm:max-h-[calc(100dvh-4rem)] sm:px-10 sm:py-8">
                <AlertDialog.Close
                  type="button"
                  disabled={submitting}
                  aria-label="Close deposit notice"
                  className="absolute right-5 top-5 flex size-9 items-center justify-center rounded-full text-ink/45 transition hover:bg-ink/5 hover:text-ink disabled:opacity-40"
                >
                  <X className="size-4" />
                </AlertDialog.Close>

                <span className="flex size-12 items-center justify-center rounded-full bg-vermilion/10 text-vermilion">
                  <ShieldAlert className="size-6" />
                </span>
                <AlertDialog.Title className="mt-6 font-display text-4xl leading-none">
                  Before you pay
                </AlertDialog.Title>
                <AlertDialog.Description className="mt-4 text-sm leading-6 text-ink/65">
                  Here is the exact price for your selected time. Please check
                  it before continuing to Stripe. Once checkout opens, you have
                  10 minutes to complete payment.
                </AlertDialog.Description>

                <div className="mt-6 rounded-2xl border border-vermilion/20 bg-vermilion/[0.06] p-5">
                  <p className="font-semibold">
                    The {yen(selectedPricing?.depositAmountJpy ?? 0)} deposit is
                    non-refundable.
                  </p>
                  <p className="mt-2 text-sm leading-6 text-ink/65">
                    It will not be refunded if you cancel or do not attend. The
                    deposit is deducted from the final amount paid in person. If
                    I cancel the booking, your deposit will be refunded.
                  </p>
                </div>

                {selectedPricing && (
                  <div className="mt-5 rounded-2xl border border-ink/10 bg-card p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">
                      Your booking · {selectedPricing.durationHours} hours
                    </p>
                    <dl className="mt-4 grid gap-3 text-sm">
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-ink/60">
                          {yen(selectedPricing.rateJpyPer30Minutes)} ×{" "}
                          {selectedPricing.durationHours * 2} half-hours
                        </dt>
                        <dd className="font-semibold">
                          {yen(selectedPricing.serviceTotalJpy)}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-ink/60">
                          25% deposit paid now
                        </dt>
                        <dd className="font-semibold">
                          − {yen(selectedPricing.depositAmountJpy)}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-4 border-t border-ink/10 pt-3">
                        <dt className="font-semibold">Pay in person</dt>
                        <dd className="font-semibold text-vermilion">
                          {yen(selectedPricing.balanceDueJpy)}
                        </dd>
                      </div>
                    </dl>
                    <p className="mt-4 border-t border-ink/10 pt-4 text-sm leading-6 text-ink/60">
                      You also cover transportation costs and any food or drinks
                      during our time together.
                    </p>
                  </div>
                )}

                {checkoutError && (
                  <p
                    role="alert"
                    className="mt-5 rounded-xl border border-vermilion/20 bg-vermilion/10 px-4 py-3 text-sm leading-6 text-vermilion"
                  >
                    {checkoutError}
                  </p>
                )}

                {turnstileSiteKey ? (
                  <div className="mt-6">
                    <TurnstileWidget
                      key={turnstileAttempt}
                      onTokenChange={handleTurnstileToken}
                      siteKey={turnstileSiteKey}
                    />
                  </div>
                ) : (
                  <p
                    role="alert"
                    className="mt-6 rounded-xl border border-vermilion/20 bg-vermilion/10 px-4 py-3 text-sm leading-6 text-vermilion"
                  >
                    Secure checkout is temporarily unavailable.
                  </p>
                )}

                <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-ink/15 p-4 text-sm leading-6 transition hover:bg-card">
                  <Checkbox.Root
                    checked={depositTermsAccepted}
                    onCheckedChange={setDepositTermsAccepted}
                    className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border border-ink/30 bg-card text-white outline-none transition data-[checked]:border-vermilion data-[checked]:bg-vermilion focus-visible:ring-2 focus-visible:ring-vermilion/35"
                  >
                    <Checkbox.Indicator>
                      <Check className="size-3.5" strokeWidth={3} />
                    </Checkbox.Indicator>
                  </Checkbox.Root>
                  <span>
                    I understand and agree to the non-refundable deposit policy.
                  </span>
                </label>

                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  <AlertDialog.Close
                    type="button"
                    disabled={submitting}
                    className="h-12 rounded-full border border-ink/15 px-5 text-sm font-semibold transition hover:bg-card disabled:opacity-40"
                  >
                    {checkoutError ? "Choose another time" : "Go back"}
                  </AlertDialog.Close>
                  <button
                    type="button"
                    disabled={
                      !depositTermsAccepted ||
                      !selectedPricing ||
                      !turnstileToken ||
                      submitting
                    }
                    onClick={() => void startCheckout()}
                    className="flex h-12 items-center justify-center gap-2 rounded-full bg-vermilion px-5 text-sm font-semibold text-white transition hover:bg-vermilion/90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {submitting ? (
                      <>
                        <LoaderCircle className="size-4 animate-spin" />
                        Opening Stripe…
                      </>
                    ) : (
                      <>
                        Agree and continue
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </button>
                </div>
              </AlertDialog.Popup>
            </AlertDialog.Viewport>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      </form>
    </div>
  )
}
