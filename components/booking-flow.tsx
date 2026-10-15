"use client"

import { ErrorToast, showError, dismissError } from "@/components/ui/toast"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { CustomIdeaEdit } from "@/components/custom-idea-edit"
import { RichDescriptionEditor } from "@/components/rich-description-editor"
import { cleanDescription } from "@/lib/rich-description"
import { BookingPriceNotice } from "@/components/booking-price-notice"
import { BookingStepper, BOOKING_STEPS } from "@/components/booking-stepper"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Checkbox as ChoiceCheckbox } from "@/components/ui/checkbox"
import { EXPERIENCE_PACKAGES, packageUnavailableReason, customIdeaLimit } from "@/lib/experience-packages"
import { AlertDialog } from "@base-ui/react/alert-dialog"
import { Checkbox } from "@base-ui/react/checkbox"
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  ShieldAlert,
  X,
} from "lucide-react"

import { EXPERIENCE_PLANS, TRANSPORT_FEE_JPY, experiencePrice, experienceStartTimes } from "@/lib/experience-plans"
import { DEPOSIT_PERCENT, cancellationPolicyText } from "@/lib/booking-policy"
import type { BookingPricing, MessagingPlatform } from "@/lib/booking"
import { cn } from "@/lib/utils"
import { WHATSAPP_COUNTRY_CODES } from "@/lib/whatsapp-country-codes"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { CustomRequestCard } from "@/components/custom-request-card"
import { AvailabilityTimeline } from "@/components/availability-timeline"
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
  telegram: {
    label: "Telegram username",
    maxLength: 33,
    pattern: "@?[A-Za-z0-9_]{5,32}",
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
  { label: "Telegram", value: "telegram" },
  { label: "X", value: "x" },
  { label: "LINE", value: "line" },
  { label: "WhatsApp", value: "whatsapp" },
  { label: "Discord", value: "discord" },
]

const TURNSTILE_TOKEN_REFRESH_AFTER_MS = 4 * 60 * 1_000

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

function startOptions(day: AvailabilityDay, pricing: BookingPricing) {
  return experienceStartTimes(day.availableTimes, pricing.minimumDurationMinutes, pricing.bookingIncrementMinutes)
}

function dayPricing(day: AvailabilityDay, pricing: BookingPricing) {
  return startOptions(day, pricing).length ? pricing : null
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
  const effectivePricing = dayPricing(day, pricing)
  if (!effectivePricing) {
    return {
      className: "border-ink/5 bg-ink/[0.08] text-ink/30",
      label: "Unavailable",
    }
  }

  const minimumSegments =
    effectivePricing.minimumDurationMinutes /
    effectivePricing.bookingIncrementMinutes
  const maximumStarts = Math.max(day.totalSegments - minimumSegments + 1, 0)
  const availableStarts = startOptions(day, effectivePricing).length

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
      label: `Plenty of ${effectivePricing.minimumDurationMinutes / 60}h+ times`,
    }
  }
  if (remainingRatio > 0.33) {
    return {
      className:
        "border-[#76A99B] bg-[#79AA9C] text-white hover:bg-[#699C8E]",
      label: `${effectivePricing.minimumDurationMinutes / 60}h+ times available`,
    }
  }
  return {
    className:
      "border-[#B8D5CD] bg-[#DCEBE7] text-[#214E43] hover:bg-[#D1E4DF]",
    label: `Limited ${effectivePricing.minimumDurationMinutes / 60}h+ times`,
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
  approval = "",
  bookingEventId = "",
  cancelToken = "",
  paymentCancelled = false,
  turnstileSiteKey,
}: {
  approval?: string
  bookingEventId?: string
  cancelToken?: string
  paymentCancelled?: boolean
  turnstileSiteKey: string
}) {
  const [validationAttempted, setValidationAttempted] = useState(false)
  const [bookingReviewed, setBookingReviewed] = useState(false)
  const [contactSummary, setContactSummary] = useState({ name: "", email: "", location: "" })
  const [currentStep, setCurrentStep] = useState(0)
  const [editingIdea, setEditingIdea] = useState<number | null>(null)
  const [customIdeaEnabled, setCustomIdeaEnabled] = useState(false)
  const [customIdeaTitle, setCustomIdeaTitle] = useState("")
  const [customIdeaHtml, setCustomIdeaHtml] = useState("")
  const [editorVersion, setEditorVersion] = useState(0)
  const [customIdeaDescription, setCustomIdeaDescription] = useState("")
  const [customIdeas, setCustomIdeas] = useState<{ title: string; description: string; descriptionHtml?: string }[]>([])
  const customIdeaDraftValid = customIdeaTitle.trim().length >= 3 && customIdeaDescription.trim().length >= 3 && customIdeaDescription.length <= 450 && customIdeaHtml.length <= 1500
  const [selectedHours, setSelectedHours] = useState<number | null>(null)
  const ideaLimit = customIdeaLimit(selectedHours ?? 4)
  const customIdeaValid = !customIdeaEnabled || (editingIdea === null && customIdeas.length <= customIdeaLimit(selectedHours ?? 4) && customIdeas.length > 0 && !customIdeaTitle.trim() && !customIdeaDescription.trim())
  const [packageNotice, setPackageNotice] = useState("")
  const [packageIds, setPackageIds] = useState<string[]>([])
  const [packagesReviewed, setPackagesReviewed] = useState(false)
  const [transportationTermsAccepted, setTransportationTermsAccepted] = useState(false)
  const [videoReviewed, setVideoReviewed] = useState(false)
  const stepTopRef = useRef<HTMLDivElement>(null)
  const [days, setDays] = useState<AvailabilityDay[]>([])
  const [visibleMonth, setVisibleMonth] = useState("")
  const [selectedDate, setSelectedDate] = useState("")
  const [selectedStart, setSelectedStart] = useState("")
  const [selectedEnd, setSelectedEnd] = useState("")

  const [dayHours, setDayHours] = useState({
    end: "23:00",
    start: "09:00",
  })
  const [peopleCount, setPeopleCount] = useState("1")
  const [faceRecordingConsent, setFaceRecordingConsent] = useState(true)
  const groupSize = Number(peopleCount)
  const validGroupSize = Number.isInteger(groupSize) && groupSize >= 1 && groupSize <= 6
  const [pricing, setPricing] = useState<BookingPricing | null>(null)
  const [transportBufferMinutes, setTransportBufferMinutes] = useState(60)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [checkoutError, setCheckoutError] = useState("")
  const [confirmationOpen, setConfirmationOpen] = useState(false)
  const [depositTermsAccepted, setDepositTermsAccepted] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState("")
  const [turnstileTokenCreatedAt, setTurnstileTokenCreatedAt] = useState(0)
  const [turnstileAttempt, setTurnstileAttempt] = useState(0)
  const [socialPlatform, setSocialPlatform] =
    useState<CustomerMessagingPlatform>("instagram")
  const [whatsAppCountryCode, setWhatsAppCountryCode] = useState("+81")
  const [whatsAppLocalNumber, setWhatsAppLocalNumber] = useState("")
  const messagingField = MESSAGING_FIELDS[socialPlatform]
  const whatsAppDigits = whatsAppLocalNumber.replace(/\D/gu, "")
  const normalizedWhatsAppNumber =
    socialPlatform === "whatsapp" && whatsAppDigits
      ? `${whatsAppCountryCode}${whatsAppDigits.replace(/^0+/u, "")}`
      : ""
  const formRef = useRef<HTMLFormElement>(null)
  const cancelCleanupDoneRef = useRef(false)
  const handleTurnstileToken = useCallback((token: string) => {
    setTurnstileToken(token)
    setTurnstileTokenCreatedAt(token ? Date.now() : 0)
  }, [])

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
      setSelectedHours(null)
      setPackageIds([])
      setPackagesReviewed(false)
      setTransportationTermsAccepted(false)
      setVideoReviewed(false)
      setCurrentStep(0)
      const firstAvailable = result.days.find(
        (day) => dayPricing(day, result.pricing!)
      )
      setSelectedDate((current) =>
        current &&
        result.days?.some(
          (day) =>
            day.date === current &&
            dayPricing(day, result.pricing!)
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
    }
  }, [])

  useEffect(() => {
    if (
      !paymentCancelled ||
      !bookingEventId ||
      !cancelToken ||
      cancelCleanupDoneRef.current
    ) {
      return
    }

    cancelCleanupDoneRef.current = true
    void (async () => {
      try {
        await fetch("/api/checkout/cancel", {
          body: JSON.stringify({ bookingEventId, cancelToken }),
          headers: { "content-type": "application/json" },
          method: "POST",
        })
      } catch (cancelError) {
        console.error("Could not release cancelled booking hold", cancelError)
      } finally {
        await loadAvailability()
      }
    })()
  }, [bookingEventId, cancelToken, paymentCancelled])

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
  const activePricing = useMemo(
    () => (activeDay && pricing ? dayPricing(activeDay, pricing) : null),
    [activeDay, pricing]
  )
  const activeStartOptions = activeDay && selectedHours
    ? experienceStartTimes(activeDay.availableTimes, selectedHours * 60)
    : []
  const selectedPricing = useMemo(() => {
    if (!activePricing || !validGroupSize || !selectedHours) return null
    return {
      ...activePricing,
      ...experiencePrice(selectedHours * 60, { peopleCount: groupSize, faceRecordingConsent, packageIds }),
    }
  }, [activePricing, validGroupSize, selectedHours, groupSize, faceRecordingConsent, packageIds])

  function navigateMonth(direction: -1 | 1) {
    const nextMonth = months[visibleMonthIndex + direction]
    if (!nextMonth) return

    setVisibleMonth(nextMonth)
    setSelectedDate("")
    setSelectedHours(null)
    setSelectedStart("")
    setSelectedEnd("")
  }

  function requestCheckout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (currentStep === 3) { continueStep(); return }
    if (!bookingReviewed || !customIdeaValid || !selectedStart || !selectedEnd || !transportationTermsAccepted || !videoReviewed || !packagesReviewed) return
    setCheckoutError("")
    setDepositTermsAccepted(false)
    setTurnstileToken("")
    setTurnstileTokenCreatedAt(0)
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

    if (
      !turnstileTokenCreatedAt ||
      Date.now() - turnstileTokenCreatedAt > TURNSTILE_TOKEN_REFRESH_AFTER_MS
    ) {
      setTurnstileToken("")
      setTurnstileTokenCreatedAt(0)
      setTurnstileAttempt((attempt) => attempt + 1)
      setCheckoutError(
        "The security check refreshed. Please wait for Success, then continue."
      )
      return
    }

    setError("")
    setSubmitting(true)

    const form = new FormData(formRef.current)
    let shouldRefreshAvailability = false
    try {
      const response = await fetch("/api/checkout/", {
        body: JSON.stringify({
          approval,
          peopleCount: groupSize,
          faceRecordingConsent,
          packageIds,
          ...(customIdeaEnabled ? { customIdeas } : {}),
          transportationTermsAccepted,
          depositTermsAccepted: true,
          email: form.get("email"),
          endTime: selectedEnd,
          location: form.get("location"),
          name: form.get("name"),
          notes: form.get("notes"),
          socialHandle:
            socialPlatform === "whatsapp"
              ? normalizedWhatsAppNumber
              : form.get("socialHandle"),
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
      setTurnstileTokenCreatedAt(0)
      setTurnstileAttempt((attempt) => attempt + 1)
      setSubmitting(false)
    }
  }

  const [approvalClock] = useState(() => Date.now())
  const needsShortNoticeApproval = !!selectedDate && !!selectedStart && new Date(`${selectedDate}T${selectedStart}:00+09:00`).getTime() - approvalClock < 7 * 86400000 && !approval
  const scheduleComplete = !!activeDay && !loading && !!selectedHours && validGroupSize && !!selectedStart && !!selectedEnd && activeStartOptions.includes(selectedStart) && !needsShortNoticeApproval
  const completed = [
    scheduleComplete,
    packagesReviewed && customIdeaValid,
    transportationTermsAccepted && videoReviewed,
    bookingReviewed,
    false,
  ]
  const canContinue = currentStep === 0 ? scheduleComplete : currentStep === 1 ? customIdeaValid : currentStep === 2 ? transportationTermsAccepted : true
  const stepWarning = canContinue ? "" : currentStep === 0
    ? !activeDay ? "Choose an available date to continue." : !selectedHours || !validGroupSize ? "Choose a duration and enter a group size from 1 to 6." : needsShortNoticeApproval ? "Bookings within 7 days require Taki’s approval. Contact Taki for a private approval link." : "Choose an available start time to continue."
    : currentStep === 1
      ? customIdeas.length > ideaLimit ? `Your plan allows ${ideaLimit} ideas. Remove an idea or choose a longer duration.` : editingIdea !== null ? "Save or cancel your edit before continuing." : customIdeaDraftValid ? "Press Add to save your idea before continuing." : "Complete your idea and press Add, or choose Skip for now."
      : "Please acknowledge the additional costs before continuing."
  const stepError = useRef<{ id: string; message: string; step: number } | null>(null)
  useEffect(() => {
    const error = stepError.current
    if (error && (canContinue || currentStep !== error.step || stepWarning !== error.message)) {
      dismissError(error.id)
      stepError.current = null
    }
  }, [canContinue, currentStep, stepWarning])
  useEffect(() => () => {
    if (stepError.current) dismissError(stepError.current.id)
  }, [])
  const showIdeaErrors = validationAttempted && currentStep === 1 && customIdeaEnabled && !customIdeaValid && editingIdea === null
  function goToStep(step: number) {
    setValidationAttempted(false)
    if (step < 4) setBookingReviewed(false)
    setCurrentStep(step)
    window.requestAnimationFrame(() => {
      stepTopRef.current?.focus({ preventScroll: true })
      stepTopRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" })
    })
  }
  function continueStep() {
    if (!canContinue) {
      const message = stepWarning || "Please complete this step."
      stepError.current = { id: showError(message), message, step: currentStep }
      setValidationAttempted(true)
      window.requestAnimationFrame(() => {
        const field = stepTopRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
        field?.focus({ preventScroll: true })
        field?.scrollIntoView({ behavior: "smooth", block: "center" })
      })
      return
    }
    if (currentStep === 1) setPackagesReviewed(true)
    if (currentStep === 2) setVideoReviewed(true)
    if (currentStep === 3) {
      if (!formRef.current?.reportValidity()) return
      const details = new FormData(formRef.current)
      setContactSummary({ name: String(details.get("name") ?? ""), email: String(details.get("email") ?? ""), location: String(details.get("location") ?? "") })
      setBookingReviewed(true)
    }
    goToStep(currentStep + 1)
  }

  return (
    <div ref={stepTopRef} tabIndex={-1} className="mx-auto grid max-w-4xl scroll-mt-24 gap-6 outline-none">
      <BookingStepper current={currentStep} completed={completed} onSelect={goToStep} />
      {packageNotice && (
        <div className="flex items-center gap-4 rounded-xl border border-vermilion/30 bg-vermilion/10 p-4 text-sm">
          <p role="status" className="min-w-0 flex-1">{packageNotice}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => {
            setPackageNotice("")
            stepTopRef.current?.focus({ preventScroll: true })
          }}>OK</Button>
        </div>
      )}
      <section
        hidden={currentStep !== 0}
        className="rounded-3xl border border-ink/10 bg-card p-5 sm:p-8"
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
                const effectiveDayPricing =
                  pricing ? dayPricing(day, pricing) : null
                const available = effectiveDayPricing
                  ? startOptions(day, effectiveDayPricing).length
                  : 0
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
                            setSelectedHours(null)
                            setPackageIds([])
                            setPackagesReviewed(false)
                            setTransportationTermsAccepted(false)
                            setVideoReviewed(false)
                            setSelectedDate(day.date)
                            setSelectedStart("")
                            setSelectedEnd("")
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
      <section hidden={currentStep !== 0} className="rounded-3xl border border-ink/10 bg-card p-5 sm:p-8">
        <p className="eyebrow">Choose your duration</p>
        <h2 className="mt-3 font-display text-3xl">How much of the day is yours?</h2>
        <p className="mt-3 text-sm text-ink/60">You pick:&nbsp;
        <span className="font-bold">
          {activeDay ? displayDate(activeDay.date, { dateStyle: "full" }) : "Choose a date above to see available plans."}
        </span>
        
        </p>
        <label className="mt-5 grid max-w-xs gap-2 text-sm font-semibold">How many guests?
          <Input type="number" min={1} max={6} step={1} value={peopleCount} onChange={event => setPeopleCount(event.target.value)} />
        </label>
        <p className="mt-2 text-xs text-ink/55">1–3 guests: standard experience fee. 4–6 guests: double the experience fee. Add-on prices are per booking.</p>
        <div className="mt-3">
          <BookingPriceNotice initiallyOpen={false} attention={currentStep === 0} />
        </div>
                <div className="mt-5 grid gap-3" role="group" aria-label="Experience options">
                  {EXPERIENCE_PLANS.map((plan) => {
                    const available = !loading && !!activeDay && experienceStartTimes(activeDay.availableTimes, plan.hours * 60).length > 0
                    const selected = selectedHours === plan.hours
                    const total = experiencePrice(plan.hours * 60, { peopleCount: validGroupSize ? groupSize : 1, faceRecordingConsent })
                    return (
                      <Button variant="outline" key={plan.hours} type="button" disabled={!available} aria-pressed={selected}
                        onClick={() => { setSelectedHours(plan.hours); setSelectedStart(""); setSelectedEnd(""); setPackageIds(ids => ids.filter(id => EXPERIENCE_PACKAGES.some(item => item.id === id && item.minimumHours <= plan.hours))); setPackagesReviewed(false); setTransportationTermsAccepted(false); setVideoReviewed(false) }}
                        className={cn("block h-auto w-full whitespace-normal rounded-2xl border p-5 text-left transition focus-visible:ring-2 focus-visible:ring-jade disabled:pointer-events-auto disabled:cursor-not-allowed disabled:opacity-40", selected ? "border-jade bg-jade/10 ring-1 ring-jade" : "border-ink/15 hover:border-jade/50")}
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span className="font-display text-2xl">{plan.durationLabel}</span>
                          <span className="text-right"><span className="block text-xl font-semibold">{yen(total.serviceTotalJpy)}</span><span className="block text-xs font-normal text-ink/60">including tax & transportation</span></span>
                        </span>
                        
                        <span className="mt-2 block font-semibold">{plan.name}</span>
                        <span className="mt-1 block text-sm leading-6 text-ink/60">{plan.description}</span>
                        <span className="mt-3 block font-bold text-md">{available ? `${yen(total.planAmountJpy)} experience + ${yen(TRANSPORT_FEE_JPY)} transportation · before tax` : `${yen(total.planAmountJpy)} experience + ${yen(TRANSPORT_FEE_JPY)} transportation · before tax`}</span>
                      </Button>
                    )
                  })}
                  <CustomRequestCard />
                </div>
                <p className="mt-3 text-xs leading-5 text-ink/50">Prices cover 1–3 guests. For 4–6 guests, the experience fee doubles; transportation stays ¥4,000 per booking. Food, drinks, and activity costs are extra. The experience fee includes a 20% surcharge when social media participation is not agreed.</p>
                <p className="mt-3 text-sm leading-6 text-ink/60">The price is fixed for your chosen plan. Your plan reserves the full 4, 8, or 14 hours; you’re welcome to finish earlier if your schedule changes. Unused time does not reduce the price or qualify for a partial refund.</p>

      </section>
      <section hidden={currentStep !== 0} className="rounded-3xl border border-ink/10 bg-card p-5 sm:p-8">
        <p className="eyebrow">Choose your start time</p>
        <h2 className="mt-3 font-display text-3xl">When shall we begin?</h2>
        <p className="mt-3 rounded-xl border border-jade/30 bg-jade/10 p-4 text-sm">Booking within 7 days? Please contact Taki first for approval and a private payment link. After payment, short-notice bookings have a 1-hour correction window for a 90% deposit refund, only before the start and before arrangements begin. After that, no refund. <a href="https://www.instagram.com/kkawataki/" target="_blank" rel="noopener noreferrer" className="underline">Contact Taki</a></p>
        <p className="mt-3 text-sm text-ink/60">Your {selectedHours ?? "chosen"}-hour plan sets the end time automatically. You can finish earlier, at the same fixed price.</p>
        {activeDay && <AvailabilityTimeline availableTimes={activeDay.availableTimes} start={dayHours.start} end={dayHours.end} selectedStart={selectedStart} selectedEnd={selectedEnd} />}
                {activeDay && !loading && selectedHours && (
                  <div className="mt-6">
                    <h4 className="mt-5 font-semibold">Choose your start time</h4>
                    <p className="mt-1 text-sm text-ink/55">Your reserved time ends at the time shown. You can finish earlier if you wish.</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label="Available start times">
                      {activeStartOptions.map((time) => {
                        const end = minutesToTime(timeToMinutes(time) + selectedHours * 60)
                        return <Button variant="outline" key={time} type="button" aria-pressed={selectedStart === time}
                          onClick={() => {
                            const removed = EXPERIENCE_PACKAGES.filter(item => packageIds.includes(item.id) && packageUnavailableReason(item, selectedHours, time, end))
                            setPackageIds(ids => ids.filter(id => !removed.some(item => item.id === id)))
                            setPackageNotice(removed.length ? `Removed ${removed.map(item => item.name).join(", ")} because your new schedule does not fit. Review your packages.` : "")
                            setPackagesReviewed(false)
                            setSelectedStart(time); setSelectedEnd(end)
                          }}
                          className={cn("block h-auto rounded-xl border px-3 py-3 text-sm transition focus-visible:ring-2 focus-visible:ring-jade", selectedStart === time ? "border-jade bg-jade text-paper" : "border-ink/15 hover:border-jade")}
                        >{displayTime(time)}<span className="mt-1 block text-xs opacity-65">until {displayTime(end)}</span></Button>
                      })}
                    </div>
                    <p className="mt-3 text-xs text-ink/50">All times are JST. A {transportBufferMinutes / 60}-hour travel buffer is reserved after your experience.</p>
                  </div>
                )}

      </section>
      <section hidden={currentStep !== 1} className="rounded-3xl border border-ink/10 bg-card p-5 sm:p-8">
        <StepLabel step={2}>Your ideas</StepLabel>
        <h2 className="mt-3 font-display text-3xl">What would you like to do?</h2>
        <p className="mt-3 text-sm leading-6 text-ink/60">Use this space to brainstorm what you’d enjoy. Add up to {ideaLimit} {ideaLimit === 1 ? "idea" : "ideas"} for your {selectedHours}-hour experience, or skip this step. Ideas help us plan; they are not confirmed reservations. We can adjust plans together until a reservation, ticket, or special arrangement is confirmed.</p>
        <div className="mt-6 grid gap-3">
          {EXPERIENCE_PACKAGES.map(item => {
            const reason = packageUnavailableReason(item, selectedHours ?? 0, selectedStart, selectedEnd)
            const eligible = !reason
            return <Card key={item.id} className={cn(packageIds.includes(item.id) && "border-jade bg-jade/5", !eligible && "opacity-50")}>
              <label className={cn("flex items-start gap-4", eligible ? "cursor-pointer" : "cursor-not-allowed")}>
                <ChoiceCheckbox checked={packageIds.includes(item.id)} disabled={!eligible} onCheckedChange={checked => { setPackageIds(ids => checked ? [...ids, item.id] : ids.filter(id => id !== item.id)); setPackagesReviewed(false) }} />
                <span className="min-w-0 flex-1"><span className="flex flex-wrap justify-between gap-2 font-semibold"><span>{item.name}</span><span>+ {yen(item.priceJpy)}</span></span><span className="mt-2 block text-sm text-ink/60">{item.description}</span>
                  {"availableFrom" in item && <span className="mt-3 block text-sm font-medium text-ink">Available from {item.availableFrom}{"availableUntil" in item ? `–${item.availableUntil}` : ""} JST{item.durationMinutes ? ` · ${item.durationMinutes / 60}-hour experience` : ""}</span>}
                  <span className="mt-2 block text-xs text-ink/55">{reason ?? item.requirement}</span></span>
              </label>
            </Card>
          })}
        </div>
        <div className="mt-5 rounded-xl border border-ink/15 p-4 text-sm leading-6">
          <h3 className="font-semibold">How ideas become plans</h3>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-ink/65">
            <li>Your booking reserves Taki’s time. It does not guarantee a particular venue, ticket, or activity.</li>
            <li>For requests needing extra preparation, Taki will confirm availability, the scope of work, and any planning fee before starting.</li>
            <li>Tickets, meals, and other third-party costs are separate. Any advance purchases require your agreement and payment first.</li>
            <li>Once an arrangement is confirmed, changes depend on availability and the provider’s rules. Taki will explain any change or cancellation costs before you commit.</li>
            <li>If an idea isn’t possible, we’ll discuss an alternative together.</li>
          </ul>
        </div>
        <Card className={cn("mt-4", customIdeaEnabled && "border-jade bg-jade/5")}>
          <label className="flex cursor-pointer items-start gap-4">
            <ChoiceCheckbox checked={customIdeaEnabled} onCheckedChange={checked => { setCustomIdeaEnabled(checked === true); setPackagesReviewed(false) }} />
            <span><span className="block font-semibold">Request your own experience</span><span className="mt-2 block text-sm text-ink/60">Share places, activities, or interests you have in mind. Sharing ideas and everyday suggestions are included. Detailed research, advance reservations, and special arrangements may require a separate planning fee, quoted before work begins.</span></span>
          </label>
          {customIdeaEnabled && <div className="mt-5 grid gap-4">
            {customIdeas.map((idea, index) => <div key={index} className="rounded-xl border border-ink/15 p-4">
              <div className="flex items-start justify-between gap-4"><p className="font-semibold">{index + 1}. {idea.title}</p><div className="flex shrink-0 gap-1"><Button type="button" variant="ghost" size="sm" disabled={editingIdea !== null} onClick={() => setEditingIdea(index)}>Edit</Button><Button type="button" variant="ghost" size="sm" disabled={editingIdea !== null} aria-label={`Remove ${idea.title}`} onClick={() => { setCustomIdeas(ideas => ideas.filter((_, i) => i !== index)); setPackagesReviewed(false) }}>Remove</Button></div></div>
              <div className="mt-2 whitespace-pre-wrap text-sm text-ink/60 [&_a]:underline [&_ul]:list-disc [&_ol]:list-decimal [&_li]:ml-5" dangerouslySetInnerHTML={{ __html: cleanDescription(idea.descriptionHtml ?? idea.description, true) }} />
              {editingIdea === index && <CustomIdeaEdit idea={idea} onCancel={() => setEditingIdea(null)} onSave={updated => {
                setCustomIdeas(ideas => ideas.map((item, i) => i === index ? updated : item))
                setEditingIdea(null); setPackagesReviewed(false)
              }} />}
            </div>)}
            <div role="status" className="flex items-center justify-between gap-4 rounded-xl border border-jade/30 bg-jade/10 px-4 py-3"><p className="text-base font-semibold text-ink">Your custom ideas</p><span className="rounded-full bg-jade px-3 py-1 text-base font-bold text-paper">{customIdeas.length} / {ideaLimit} added</span><span className="sr-only">{customIdeas.length >= ideaLimit ? "Maximum reached." : ""}</span></div>
            {customIdeas.length > ideaLimit && <p className="text-sm text-vermilion">Your current plan allows {ideaLimit} ideas. Remove an idea or choose a longer duration. Your ideas are kept until you decide.</p>}
            {customIdeas.length < ideaLimit && <>

            <label className="grid gap-2 text-sm font-medium">Title
              <Input aria-invalid={showIdeaErrors && customIdeaTitle.trim().length < 3} className={cn(showIdeaErrors && customIdeaTitle.trim().length < 3 && "border-red-500 ring-1 ring-red-500")} value={customIdeaTitle} maxLength={100} minLength={3} onChange={event => { setCustomIdeaTitle(event.target.value); setPackagesReviewed(false) }} placeholder="Visit vintage camera shops" />
            </label>
            <div className="grid gap-2 text-sm font-medium"><p>Description</p>
              <RichDescriptionEditor invalid={showIdeaErrors && (customIdeaDescription.trim().length < 3 || customIdeaDescription.length > 450 || customIdeaHtml.length > 1500)} key={editorVersion} onChange={(text, html) => { setCustomIdeaDescription(text); setCustomIdeaHtml(html); setPackagesReviewed(false) }} />
            </div>
            {showIdeaErrors && !customIdeaDraftValid && <ErrorToast>Please enter a title (3–100 characters) and description (3–450 characters).</ErrorToast>}
            <p className="text-xs text-ink/60">Enter at least 3 characters in each field, then press Add. {customIdeaDescription.length}/450 characters.</p>
            {customIdeaHtml.length > 1500 && <ErrorToast>Please shorten links or simplify formatting.</ErrorToast>}
            <Button type="button" className="justify-self-end" disabled={customIdeas.length >= ideaLimit} onClick={() => {
              if (!customIdeaDraftValid || customIdeas.length >= ideaLimit) { setValidationAttempted(true); return }
              setValidationAttempted(false)
              setCustomIdeas(ideas => [...ideas, { title: customIdeaTitle.trim(), description: customIdeaDescription.trim(), descriptionHtml: cleanDescription(customIdeaHtml) }])
              setCustomIdeaTitle(""); setCustomIdeaDescription(""); setCustomIdeaHtml(""); setEditorVersion(version => version + 1); setPackagesReviewed(false)
            }}>Add</Button>
            </>}

          </div>}
        </Card>
        <p className="mt-4 text-sm text-ink/60">{packageIds.length ? `${packageIds.length} selected · ${yen(selectedPricing?.packagesTotalJpy ?? 0)}` : customIdeaEnabled && customIdeas.length ? `${customIdeas.length} custom ideas added · any extra costs confirmed separately.` : "No ideas yet? That’s fine—we can plan together later."}</p>
      </section>
      <section hidden={currentStep !== 2} className="rounded-3xl border border-ink/10 bg-card p-5 sm:p-8">
        <StepLabel step={3}>Preferences & costs</StepLabel>
        <h2 className="mt-3 font-display text-3xl">Costs to keep in mind.</h2>
        <Card className="mt-6"><h3 className="font-semibold">Food &amp; drinks</h3><p className="mt-3 text-sm leading-6 text-ink/60">Paid separately. Food and drinks are not included in your booking total unless explicitly included in a selected package. Have a restaurant or meal in mind? Let Taki know in advance, or let him choose somewhere based on your tastes, dietary needs, and budget.</p></Card>
        <Card className="mt-4"><div className="flex justify-between font-semibold"><span>Transportation fee</span><span>{yen(TRANSPORT_FEE_JPY)}</span></div><p className="mt-3 text-sm leading-6 text-ink/60">A fixed fee of ¥4,000, included in your total. Longer trips, such as travel outside Tokyo, cost extra. Taki will confirm any additional fee with you in advance.</p></Card>
        <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-ink/15 p-4 text-sm leading-6"><ChoiceCheckbox checked={transportationTermsAccepted} onCheckedChange={checked => setTransportationTermsAccepted(checked === true)} /><span>I understand that food and drink costs are paid separately unless included in my selected package, and that the {yen(TRANSPORT_FEE_JPY)} transportation fee is included in my booking total. Any exceptional long-distance travel costs require a separately agreed quote before booking. I understand that ideas are requests, not confirmed arrangements; extra preparation and purchases require a separate agreement, and confirmed arrangements may have change or cancellation costs.</span></label>
      </section>
      <section hidden={currentStep !== 2} className="rounded-3xl border border-ink/10 bg-card p-5 sm:p-8">
        <p className="eyebrow">Video participation</p>
        <h2 className="mt-3 font-display text-3xl">Wanna be part of my contents?</h2>
        <p className="mt-3 text-sm leading-6 text-ink/60">Participation is optional. You can continue without agreeing. Each guest can choose whether to appear.</p>
        <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-ink/15 p-5 text-sm leading-6"><ChoiceCheckbox checked={faceRecordingConsent} onCheckedChange={checked => { setFaceRecordingConsent(checked === true); setVideoReviewed(false) }} /><span>I agree to appear in your videos and social media content, which may include my face.<span className="mt-2 block text-ink/60">Selected by default. Uncheck if you do not want to appear. Unchecking adds 20% to the experience fee; transportation and packages are unchanged.</span></span></label>
        <div role="status" aria-live="polite" aria-atomic="true" className={cn("mt-5 rounded-xl border p-4 text-sm leading-6", faceRecordingConsent ? "border-jade/30 bg-jade/10" : "border-vermilion/40 bg-vermilion/10")}>
          {faceRecordingConsent ? (
            <p><strong>Video participation selected.</strong> Your total includes no non-participation surcharge.</p>
          ) : (
            <p><strong>Video participation declined. {selectedHours && validGroupSize ? `Your total increases by ${yen(experiencePrice(selectedHours * 60, { peopleCount: groupSize, faceRecordingConsent: false, packageIds }).serviceTotalJpy - experiencePrice(selectedHours * 60, { peopleCount: groupSize, faceRecordingConsent: true, packageIds }).serviceTotalJpy)}.` : "A 20% experience fee surcharge applies."}</strong> You will not be asked to appear in videos.</p>
          )}
          {selectedPricing && <p className="mt-2 font-semibold">Your total: {yen(selectedPricing.serviceTotalJpy)}</p>}
        </div>
        <Card className="mt-5"><div className="flex justify-between"><span>Without participation</span><strong>{selectedHours && validGroupSize ? yen(experiencePrice(selectedHours * 60, { peopleCount: groupSize, faceRecordingConsent: false, packageIds }).serviceTotalJpy) : "¥0"}</strong></div><div className="mt-3 flex justify-between"><span>With participation</span><strong>{selectedHours && validGroupSize ? yen(experiencePrice(selectedHours * 60, { peopleCount: groupSize, faceRecordingConsent: true, packageIds }).serviceTotalJpy) : "¥0"}</strong></div><p className="mt-3 text-xs text-ink/55">Totals include packages, transportation, and tax.</p></Card>
      </section>

      <section hidden={currentStep !== 4} className="rounded-3xl border border-ink/10 bg-card p-6 text-ink sm:p-8">
        <StepLabel step={5}>Review & pay</StepLabel>
        <h2 className="mt-3 font-display text-4xl">Your experience, at a glance.</h2>
        <p className="mt-3 text-sm leading-6 text-ink/60">Check your schedule, contact details, ideas, and total. Your booking is confirmed after payment.</p>
        {selectedPricing && <div className="mt-6 rounded-2xl border border-ink/20 p-5 text-sm">
          <p className="font-semibold">{selectedDate} · {selectedHours} hours · {selectedStart}–{selectedEnd} JST</p>
          <p className="mt-2 text-ink/65">{contactSummary.name} · {contactSummary.email}</p>
          {contactSummary.location && <p className="mt-1 text-ink/65">Meeting point: {contactSummary.location}</p>}
          <dl className="mt-4 grid gap-3">
            <div className="flex justify-between"><dt>Experience · {groupSize} guests</dt><dd>{yen(selectedPricing.planAmountJpy)}</dd></div>
            {packageIds.map(id => { const item = EXPERIENCE_PACKAGES.find(item => item.id === id)!; return <div key={id} className="flex justify-between"><dt>{item.name}</dt><dd>{yen(item.priceJpy)}</dd></div> })}
            <div className="flex justify-between"><dt>Transportation</dt><dd>{yen(selectedPricing.transportFeeJpy)}</dd></div><div className="flex justify-between"><dt>Tax ({selectedPricing.taxRate * 100}%)</dt><dd>{yen(selectedPricing.taxAmountJpy)}</dd></div>
            <div className="flex justify-between border-t border-ink/20 pt-3 font-semibold"><dt>Total</dt><dd><span className="font-bold text-vermilion">{yen(selectedPricing.depositAmountJpy)}</span></dd></div>
            {/* <div className="flex justify-between"><dt>{selectedPricing.depositPercent === 100 ? "Full payment now" : `${selectedPricing.depositPercent}% deposit now`}</dt><dd><span className="font-bold text-vermilion">{yen(selectedPricing.depositAmountJpy)}</span></dd></div> */}
            {selectedPricing.depositPercent < 100 && selectedPricing.balanceDueJpy > 0 ? <div className="flex justify-between"><dt>Remaining balance</dt><dd>{yen(selectedPricing.balanceDueJpy)}</dd></div> : null}
          </dl>
          {customIdeaEnabled && customIdeas.map((idea, index) => <div key={index} className="mt-4 rounded-xl border border-ink/20 p-4"><p className="font-semibold">Custom idea {index + 1}: {idea.title}</p><div className="mt-2 whitespace-pre-wrap text-sm text-ink/70 [&_a]:underline [&_ul]:list-disc [&_ol]:list-decimal [&_li]:ml-5" dangerouslySetInnerHTML={{ __html: cleanDescription(idea.descriptionHtml ?? idea.description, true) }} /><p className="mt-2 text-xs text-ink/60">Requested idea—not a confirmed reservation. Preparation fees and purchases are agreed separately; confirmed arrangements may limit changes.</p></div>)}
          <p className="mt-4 text-ink/65">Video participation: {faceRecordingConsent ? "agreed" : "not agreed"}. Additional costs and custom-idea conditions acknowledged.</p>
        </div>}
        <aside className="mt-5 rounded-2xl border border-ink/20 p-5 text-sm">
          <p className="font-semibold">Plans change. You can cancel online.</p>
          <p className="mt-2 leading-6 text-ink/70">Cancel online and see your refund before confirming. Within 7 days of payment: 90% back when your experience is at least 7 days away. After that window: 75% back with 30+ days’ notice, or 50% with 7–30 days’ notice. Short-notice exceptions apply.</p>
          <a href="/cancel" target="_blank" rel="noopener noreferrer" className="mt-3 inline-block underline">View cancellation details ↗</a>
        </aside>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button type="button" variant="ghost" onClick={() => goToStep(0)}>Edit date & time</Button>
          <Button type="button" variant="ghost" onClick={() => goToStep(1)}>Edit ideas</Button>
          <Button type="button" variant="ghost" onClick={() => goToStep(2)}>Edit preferences & costs</Button>
          <Button type="button" variant="ghost" onClick={() => goToStep(3)}>Edit your details</Button>
        </div>
      </section>

      <form
        ref={formRef}
        onSubmit={requestCheckout}
        hidden={currentStep !== 3 && currentStep !== 4}
        className="rounded-3xl border border-ink/10 bg-card p-6 text-ink sm:p-8"
      >
        <div hidden={currentStep !== 3}>
        <StepLabel step={4}>
          Your details
        </StepLabel>
        <h2 className="mt-3 font-display text-4xl">How can I reach you?</h2>
        <p className="mt-3 text-sm leading-6 text-ink/60">Add your contact details and meeting preferences. You’ll review everything before paying.</p>
        <div className="mt-7 grid gap-5">
          <label className="grid gap-2 text-sm font-semibold">
            Name (Nickname)
            <Input
              name="name"
              required
              maxLength={80}
              autoComplete="name"
              className="h-12 rounded-xl border border-ink/15 bg-ink/5 px-4 font-normal text-ink outline-none placeholder:text-ink/30 focus:border-jade-light"
              placeholder="Your nickname, e.g. Taki"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Email
            <Input
              name="email"
              required
              type="email"
              maxLength={254}
              autoComplete="email"
              className="h-12 rounded-xl border border-ink/15 bg-ink/5 px-4 font-normal text-ink outline-none placeholder:text-ink/30 focus:border-jade-light"
              placeholder="you@example.com"
            />
          </label>

          <fieldset className="grid gap-3">
            <legend className="text-sm font-semibold">
              Where should I message you?
            </legend>
            <p className="text-xs leading-5 text-ink/50">
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
                  className="h-12 w-full appearance-none rounded-xl border border-[#76A99B] bg-ink/5 px-4 pr-11 font-normal text-ink outline-none transition focus:border-[#286557] focus:ring-2 focus:ring-[#79AA9C]/30 disabled:cursor-not-allowed"
                >
                  {MESSAGING_OPTIONS.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      className="bg-card text-ink"
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  aria-hidden="true"
                  className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-ink/55"
                />
              </span>
            </label>

            {socialPlatform === "whatsapp" ? (
              <div className="grid gap-2 text-sm font-semibold">
                <span>{messagingField.label}</span>
                <div className="grid gap-3 sm:grid-cols-[13rem_1fr]">
                  <label className="relative">
                    <span className="absolute -top-2 left-4 bg-card px-1 text-xs font-normal leading-none text-ink/55">
                      Country
                    </span>
                    <select
                      value={whatsAppCountryCode}
                      onChange={(event) =>
                        setWhatsAppCountryCode(event.target.value)
                      }
                      className="h-13 w-full appearance-none rounded-xl border border-ink/25 bg-ink/5 px-4 pr-11 text-base font-semibold text-ink outline-none transition focus:border-[#76A99B] focus:ring-2 focus:ring-[#79AA9C]/30"
                      aria-label="WhatsApp country code"
                    >
                      {WHATSAPP_COUNTRY_CODES.map((country) => (
                        <option
                          key={`${country.iso2}-${country.code}`}
                          value={country.code}
                          className="bg-card text-ink"
                        >
                          {country.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      aria-hidden="true"
                      className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-ink/55"
                    />
                  </label>
                  <label className="sr-only" htmlFor="whatsapp-local-number">
                    WhatsApp local phone number
                  </label>
                  <Input
                    id="whatsapp-local-number"
                    required
                    minLength={7}
                    maxLength={20}
                    pattern="[0-9 ()-]{7,20}"
                    inputMode="tel"
                    autoComplete="tel-national"
                    value={whatsAppLocalNumber}
                    onChange={(event) =>
                      setWhatsAppLocalNumber(event.target.value)
                    }
                    className="h-13 rounded-xl border border-ink/25 bg-ink/5 px-4 text-base font-normal text-ink outline-none placeholder:text-ink/35 transition focus:border-[#76A99B] focus:ring-2 focus:ring-[#79AA9C]/30"
                    placeholder="Phone"
                  />
                </div>
                <Input
                  name="socialHandle"
                  type="hidden"
                  value={normalizedWhatsAppNumber}
                />
              </div>
            ) : (
              <label className="grid gap-2 text-sm font-semibold">
                {messagingField.label}
                <span className="flex h-12 items-center rounded-xl border border-ink/15 bg-ink/5 px-4 transition-colors focus-within:border-[#76A99B]">
                  {messagingField.prefix && (
                    <span
                      aria-hidden="true"
                      className="font-normal text-ink/55"
                    >
                      {messagingField.prefix}
                    </span>
                  )}
                  <Input
                    name="socialHandle"
                    required
                    minLength={1}
                    maxLength={messagingField.maxLength}
                    pattern={messagingField.pattern}
                    inputMode={messagingField.inputMode ?? "text"}
                    autoComplete="off"
                    className={cn(
                      "min-w-0 flex-1 rounded-none border-0 bg-transparent font-normal text-ink outline-none placeholder:text-ink/30 focus-visible:ring-0 disabled:cursor-not-allowed",
                      messagingField.prefix && "pl-0.5"
                    )}
                    placeholder={messagingField.placeholder}
                  />
                </span>
              </label>
            )}
          </fieldset>
          <label className="grid gap-2 text-sm font-semibold">
            What would you like to do?
            <Input
              name="title"
              required
              minLength={3}
              maxLength={100}
              className="h-12 rounded-xl border border-ink/15 bg-ink/5 px-4 font-normal text-ink outline-none placeholder:text-ink/30 focus:border-jade-light"
              placeholder="Explore record shops in Shimokitazawa"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Meeting location
            <Input
              name="location"
              required
              minLength={2}
              maxLength={120}
              autoComplete="street-address"
              className="h-12 rounded-xl border border-ink/15 bg-ink/5 px-4 font-normal text-ink outline-none placeholder:text-ink/30 focus:border-jade-light"
              placeholder="Shibuya Station Hachiko Exit"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Anything else? <span className="font-normal text-ink/40">Optional</span>
            <textarea
              name="notes"
              maxLength={450}
              rows={4}
              className="resize-y rounded-xl border border-ink/15 bg-ink/5 px-4 py-3 font-normal text-ink outline-none placeholder:text-ink/30 focus:border-jade-light"
              placeholder="Interests, accessibility needs, where you are staying…"
            />
          </label>
        </div>

        </div>
        {error && days.length > 0 && (
          <ErrorToast>
            {error}
          </ErrorToast>
        )}

        <button
          type="submit"
          hidden={currentStep !== 4}
          disabled={!selectedPricing || !selectedStart || !selectedEnd || !transportationTermsAccepted || !packagesReviewed || !videoReviewed || submitting || loading}
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
                ? `Pay ${yen(selectedPricing.depositAmountJpy)} in full`
                : "Choose your experience and start time"}
              <ArrowRight className="size-4" />
            </>
          )}
        </button>

        <p hidden={currentStep !== 4} className="mt-4 flex items-center justify-center gap-2 text-xs text-ink/45">
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
                setTurnstileTokenCreatedAt(0)
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
                  aria-label="Close payment notice"
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
                    The payment of {yen(selectedPricing?.depositAmountJpy ?? 0)} reserves your time.
                  </p>
                  <p className="mt-2 text-sm leading-6 text-ink/65">
                    {selectedPricing && selectedPricing.depositPercent < 100 && selectedPricing.balanceDueJpy > 0 ? "Your deposit is deducted from the booking total. The remaining balance is paid in person." : "Your booking is paid in full."} Separately agreed extras are additional.
                    {" "}{cancellationPolicyText()}
                  </p>
                </div>

                {selectedPricing && (
                  <div className="mt-5 rounded-2xl border border-ink/10 bg-card p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">
                      Your booking · {selectedPricing.durationHours} hours · {groupSize} people
                    </p>
                    <p className="mt-2 text-sm">Experience fee: {Math.ceil(groupSize / 3)}× for your group{faceRecordingConsent ? "; no non-participation surcharge" : "; plus 20% non-participation surcharge"}. Social media participation: {faceRecordingConsent ? "agreed" : "not agreed"}.</p>
                    <dl className="mt-4 grid gap-3 text-sm">
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-ink/60">
                          {selectedPricing.durationHours}-hour experience
                        </dt>
                        <dd className="font-semibold">
                          {yen(selectedPricing.planAmountJpy)}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-4"><dt className="text-ink/60">Packages</dt><dd>{yen(selectedPricing.packagesTotalJpy)}</dd></div>
                      <div className="flex items-center justify-between gap-4"><dt className="text-ink/60">Transportation</dt><dd>{yen(selectedPricing.transportFeeJpy)}</dd></div><div className="flex justify-between"><dt>Tax ({selectedPricing.taxRate * 100}%)</dt><dd>{yen(selectedPricing.taxAmountJpy)}</dd></div>
                      <div className="flex items-center justify-between gap-4 font-semibold"><dt>Booking total</dt><dd>{yen(selectedPricing.serviceTotalJpy)}</dd></div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-ink/60">
                          {selectedPricing.depositPercent}% paid now
                        </dt>
                        <dd className="font-semibold">
                          {yen(selectedPricing.depositAmountJpy)}
                        </dd>
                      </div>
                      {selectedPricing.depositPercent < 100 && selectedPricing.balanceDueJpy > 0 ? (
                      <div className="flex items-center justify-between gap-4 border-t border-ink/10 pt-3">
                        <dt className="font-semibold">Pay in person</dt>
                        <dd className="font-semibold text-vermilion">
                          {yen(selectedPricing.balanceDueJpy)}
                        </dd>
                      </div>
                      ) : null}
                    </dl>
                    <p className="mt-4 border-t border-ink/10 pt-4 text-sm leading-6 text-ink/60">
                      Transportation is included above. Food, drinks, and activity costs are extra. You may finish earlier; the fixed plan price remains the same and unused time is not refunded.
                    </p>
                  </div>
                )}

                {checkoutError && (
                  <ErrorToast>
                    {checkoutError}
                  </ErrorToast>
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
                  <ErrorToast>
                    Secure checkout is temporarily unavailable.
                  </ErrorToast>
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
                    I understand and agree to the payment and cancellation policy.
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
      
      <div className="flex flex-wrap items-center justify-between gap-4 pb-8">
        <Button type="button" variant="outline" size="lg" disabled={currentStep === 0 || submitting} onClick={() => goToStep(currentStep - 1)}>Back</Button>
        {currentStep === 1 && <Button type="button" variant="ghost" onClick={() => { setCustomIdeaEnabled(false); setPackageIds([]); setEditingIdea(null); setPackagesReviewed(true); goToStep(2) }}>Skip for now</Button>}
        {currentStep < BOOKING_STEPS.length - 1 && <Button type="button" size="lg" disabled={loading || submitting} onClick={continueStep}>Continue to {BOOKING_STEPS[currentStep + 1]} <ArrowRight /></Button>}
      </div>
      {!confirmationOpen && (
        <aside aria-label="Booking price summary" aria-live="polite" className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/15 bg-paper/95 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] text-ink shadow-xl backdrop-blur-md lg:inset-x-auto lg:right-6 lg:bottom-6 lg:w-96 lg:rounded-2xl lg:border lg:p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs text-ink/65">{selectedPricing ? `${selectedPricing.durationHours} hours · ${groupSize} ${groupSize === 1 ? "person" : "people"}` : "Your booking"}</p>
              <p className="mt-1 text-base font-semibold">{yen(selectedPricing?.serviceTotalJpy ?? 0)} total</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs text-ink/65">{selectedPricing?.depositPercent ?? DEPOSIT_PERCENT}% payment</p>
              <p className="mt-1 text-lg font-semibold text-vermilion">{yen(selectedPricing?.depositAmountJpy ?? 0)}</p>
            </div>
          </div>
        </aside>
      )}
    </div>
  )
}
