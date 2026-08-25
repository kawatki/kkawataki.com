"use client"

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  Crown,
  LoaderCircle,
  LockKeyhole,
  Minus,
  Plus,
  Scissors,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { TurnstileWidget } from "@/components/turnstile-widget"
import { Button, buttonVariants } from "@/components/ui/button"
import { formatYen, type PackageItem } from "@/lib/packages"
import { cn } from "@/lib/utils"

type CartLine = {
  packageId: string
  quantity: number
}

const STORAGE_KEY = "rental-japanese-guy:package-cart"
const TURNSTILE_TOKEN_REFRESH_AFTER_MS = 4 * 60 * 1_000
const packageIcons = {
  crown: Crown,
  scissors: Scissors,
}

type CustomerMessagingPlatform = "discord" | "instagram" | "line" | "whatsapp" | "x"

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

function readCart() {
  if (typeof window === "undefined") {
    return []
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]")
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .filter(
        (line): line is CartLine =>
          typeof line?.packageId === "string" &&
          Number.isInteger(line?.quantity) &&
          line.quantity > 0
      )
      .map((line) => ({
        packageId: line.packageId,
        quantity: line.quantity,
      }))
  } catch {
    return []
  }
}

export function PackageCart({
  packages,
  turnstileSiteKey,
}: {
  packages: PackageItem[]
  turnstileSiteKey: string
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const storageReadyRef = useRef(false)
  const [cart, setCart] = useState<CartLine[]>([])
  const [socialPlatform, setSocialPlatform] =
    useState<CustomerMessagingPlatform>("instagram")
  const [isOpen, setIsOpen] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState("")
  const [turnstileTokenCreatedAt, setTurnstileTokenCreatedAt] = useState(0)
  const [turnstileAttempt, setTurnstileAttempt] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const timer = window.setTimeout(() => {
      storageReadyRef.current = true
      setCart(readCart())
    }, 0)

    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (storageReadyRef.current) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cart))
    }
  }, [cart])

  const cartItems = useMemo(
    () =>
      cart.flatMap((line) => {
        const item = packages.find((candidate) => candidate.id === line.packageId)
        if (!item) {
          return []
        }

        const quantity = Math.min(line.quantity, item.maxPeople)

        return [
          {
            ...item,
            quantity,
            lineTotal: item.pricePerPerson * quantity,
          },
        ]
      }),
    [cart, packages]
  )

  const totalGuests = cartItems.reduce((sum, item) => sum + item.quantity, 0)
  const totalPrice = cartItems.reduce((sum, item) => sum + item.lineTotal, 0)
  const hasSelection = cartItems.length > 0
  const messagingField = MESSAGING_FIELDS[socialPlatform]
  const handleTurnstileTokenChange = useCallback((token: string) => {
    setTurnstileToken(token)
    setTurnstileTokenCreatedAt(token ? Date.now() : 0)
    setError("")
  }, [])

  function setQuantity(packageId: string, nextQuantity: number) {
    const item = packages.find((candidate) => candidate.id === packageId)
    if (!item) {
      return
    }

    const clampedQuantity = Math.max(0, Math.min(item.maxPeople, nextQuantity))

    setCart((current) => {
      const existing = current.find((line) => line.packageId === packageId)

      if (clampedQuantity === 0) {
        return current.filter((line) => line.packageId !== packageId)
      }

      if (!existing) {
        return [{ packageId, quantity: clampedQuantity }]
      }

      return current.map((line) =>
        line.packageId === packageId
          ? { ...line, quantity: clampedQuantity }
          : line
      )
    })
  }

  function addPackage(item: PackageItem) {
    const existing = cart.find((line) => line.packageId === item.id)
    const nextQuantity = Math.min(existing?.quantity ?? 1, item.maxPeople)
    setCart([{ packageId: item.id, quantity: nextQuantity }])
    setIsOpen(true)
    toast.success(`${item.shortTitle} selected`)
  }

  async function startPackageCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!formRef.current || !cartItems.length || submitting) {
      return
    }

    if (!turnstileSiteKey) {
      setError("Secure checkout is temporarily unavailable.")
      return
    }

    if (!turnstileToken) {
      setError("Please complete the security check before payment.")
      return
    }

    if (
      !turnstileTokenCreatedAt ||
      Date.now() - turnstileTokenCreatedAt > TURNSTILE_TOKEN_REFRESH_AFTER_MS
    ) {
      setTurnstileToken("")
      setTurnstileTokenCreatedAt(0)
      setTurnstileAttempt((attempt) => attempt + 1)
      setError("The security check refreshed. Please wait for Success, then continue.")
      return
    }

    setSubmitting(true)
    setError("")

    const form = new FormData(formRef.current)
    try {
      const response = await fetch("/api/package-checkout/", {
        body: JSON.stringify({
          email: form.get("email"),
          lines: cartItems.map((item) => ({
            packageId: item.id,
            quantity: item.quantity,
          })),
          name: form.get("name"),
          notes: form.get("notes"),
          preferredDate: form.get("preferredDate"),
          socialHandle: form.get("socialHandle"),
          socialPlatform,
          termsAccepted,
          turnstileToken,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
      const result = (await response.json()) as { error?: string; url?: string }
      if (!response.ok || !result.url) {
        throw new Error(result.error ?? "Checkout could not be started.")
      }
      window.location.assign(result.url)
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Checkout could not be started."
      )
      setTurnstileToken("")
      setTurnstileTokenCreatedAt(0)
      setTurnstileAttempt((attempt) => attempt + 1)
      setSubmitting(false)
    }
  }

  return (
    <div className="relative">
      <div className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 sm:bottom-6 sm:left-auto sm:right-6 sm:w-auto sm:translate-x-0">
        <Button
          type="button"
          onClick={() => setIsOpen(true)}
          className="h-13 w-full rounded-full bg-ink px-5 text-paper shadow-xl shadow-ink/15 hover:bg-vermilion sm:w-auto"
          aria-label={`Open package cart with ${totalGuests} guests`}
        >
          <ShoppingBag className="size-5" />
          Selected package
          <span className="ml-1 rounded-full bg-paper px-2 py-0.5 text-xs font-bold text-ink">
            {totalGuests}
          </span>
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {packages.map((item) => {
          const Icon = packageIcons[item.icon]
          const quantity =
            cart.find((line) => line.packageId === item.id)?.quantity ?? 0

          return (
            <article
              key={item.id}
              className="grid min-h-[34rem] overflow-hidden rounded-2xl border border-ink/10 bg-card shadow-sm shadow-ink/5"
            >
              <div className="flex min-h-[17.25rem] flex-col bg-ink p-7 text-paper sm:min-h-[19rem]">
                <div className="flex items-start justify-between gap-6">
                  <div className="min-h-[8.5rem] sm:min-h-[10.5rem]">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-paper/50">
                      Package plan
                    </p>
                    <h2 className="mt-4 max-w-xl font-display text-4xl leading-[0.96] tracking-tight sm:text-5xl">
                      {item.title}
                    </h2>
                  </div>
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-vermilion">
                    <Icon className="size-6" />
                  </span>
                </div>

                <div className="mt-auto grid grid-cols-3 gap-px overflow-hidden rounded-xl bg-paper/15">
                  <div className="bg-ink/80 p-4">
                    <p className="text-[0.68rem] uppercase tracking-[0.16em] text-paper/45">
                      Time
                    </p>
                    <p className="mt-2 font-display text-3xl">{item.durationHours}h</p>
                  </div>
                  <div className="bg-ink/80 p-4">
                    <p className="text-[0.68rem] uppercase tracking-[0.16em] text-paper/45">
                      Price
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-5">
                      {formatYen(item.pricePerPerson)}
                      <br />
                      per person
                    </p>
                  </div>
                  <div className="bg-ink/80 p-4">
                    <p className="text-[0.68rem] uppercase tracking-[0.16em] text-paper/45">
                      Group
                    </p>
                    <p className="mt-2 font-display text-3xl">{item.maxPeople}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col p-7">
                <div className="flex flex-wrap gap-2">
                  {item.route.map((label) => (
                    <span
                      key={label}
                      className="rounded-full border border-ink/10 bg-cream px-3 py-1 text-xs font-semibold text-ink/65"
                    >
                      {label}
                    </span>
                  ))}
                </div>

                <ul className="mt-7 grid gap-4">
                  {item.highlights.map((highlight) => (
                    <li key={highlight} className="flex gap-3 text-sm leading-6 text-ink/68">
                      <Check className="mt-1 size-4 shrink-0 text-vermilion" />
                      <span>{highlight}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-8">
                  <div className="mb-4 flex items-center justify-between gap-4 rounded-xl bg-cream p-3">
                    <span className="text-sm font-semibold">Guests</span>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="rounded-full bg-card"
                        onClick={() => setQuantity(item.id, quantity - 1)}
                        disabled={quantity === 0}
                        aria-label={`Remove one guest from ${item.title}`}
                      >
                        <Minus />
                      </Button>
                      <span className="grid w-8 place-items-center font-mono text-sm">
                        {quantity}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="rounded-full bg-card"
                        onClick={() => setQuantity(item.id, quantity + 1)}
                        disabled={quantity >= item.maxPeople}
                        aria-label={`Add one guest to ${item.title}`}
                      >
                        <Plus />
                      </Button>
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={() => addPackage(item)}
                    className="h-12 w-full rounded-full bg-ink px-6 text-paper hover:bg-vermilion"
                  >
                    <ShoppingBag />
                    {quantity > 0 ? "Selected" : "Choose package"}
                  </Button>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-[80]">
          <button
            type="button"
            aria-label="Close package cart"
            className="absolute inset-0 bg-ink/35 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          <aside className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col overflow-y-auto bg-paper p-6 shadow-2xl shadow-black/30 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Selected package</p>
                <h2 className="mt-3 font-display text-4xl tracking-tight">
                  Package request
                </h2>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon-lg"
                className="rounded-full bg-card"
                onClick={() => setIsOpen(false)}
                aria-label="Close package cart"
              >
                <X />
              </Button>
            </div>

            <form ref={formRef} onSubmit={startPackageCheckout} className="mt-8 flex-1">
              {cartItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-ink/20 p-8 text-center">
                  <ShoppingBag className="mx-auto size-8 text-ink/35" />
                  <p className="mt-4 font-display text-2xl">No package selected.</p>
                  <p className="mt-2 text-sm leading-6 text-ink/55">
                    Choose one package plan to continue.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {cartItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-ink/10 bg-card p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-display text-2xl leading-7">
                            {item.shortTitle}
                          </h3>
                          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-ink/45">
                            {item.durationHours}h / max {item.maxPeople} guests
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="rounded-full text-ink/45 hover:text-vermilion"
                          onClick={() => setQuantity(item.id, 0)}
                          aria-label={`Remove ${item.title} from cart`}
                        >
                          <Trash2 />
                        </Button>
                      </div>

                      <div className="mt-5 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            className="rounded-full bg-paper"
                            onClick={() => setQuantity(item.id, item.quantity - 1)}
                            aria-label={`Decrease ${item.title} guests`}
                          >
                            <Minus />
                          </Button>
                          <span className="grid w-8 place-items-center font-mono text-sm">
                            {item.quantity}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            className="rounded-full bg-paper"
                            onClick={() => setQuantity(item.id, item.quantity + 1)}
                            disabled={item.quantity >= item.maxPeople}
                            aria-label={`Increase ${item.title} guests`}
                          >
                            <Plus />
                          </Button>
                        </div>
                        <p className="text-sm font-bold">{formatYen(item.lineTotal)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <fieldset
                disabled={!hasSelection}
                aria-disabled={!hasSelection}
                className={cn(
                  "mt-8 grid gap-4 border-t border-ink/10 pt-6 transition-opacity",
                  !hasSelection && "pointer-events-none opacity-35"
                )}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-semibold">
                    Name
                    <input
                      name="name"
                      required
                      maxLength={80}
                      autoComplete="name"
                      className="h-12 rounded-xl border border-ink/15 bg-card px-4 font-normal outline-none placeholder:text-ink/35 focus:border-jade"
                      placeholder="Your name"
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
                      className="h-12 rounded-xl border border-ink/15 bg-card px-4 font-normal outline-none placeholder:text-ink/35 focus:border-jade"
                      placeholder="you@example.com"
                    />
                  </label>
                </div>

                <fieldset className="grid gap-3">
                  <legend className="text-sm font-semibold">
                    Where should I message you?
                  </legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2 text-sm font-semibold">
                      Messaging app
                      <span className="relative">
                        <select
                          value={socialPlatform}
                          onChange={(event) =>
                            setSocialPlatform(
                              event.target.value as CustomerMessagingPlatform
                            )
                          }
                          className="h-12 w-full appearance-none rounded-xl border border-ink/15 bg-card px-4 pr-11 font-normal outline-none transition focus:border-jade"
                        >
                          {MESSAGING_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          aria-hidden="true"
                          className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-ink/45"
                        />
                      </span>
                    </label>

                    <label className="grid gap-2 text-sm font-semibold">
                      {messagingField.label}
                      <span className="flex h-12 items-center rounded-xl border border-ink/15 bg-card px-4 transition-colors focus-within:border-jade">
                        {messagingField.prefix && (
                          <span aria-hidden="true" className="font-normal text-ink/45">
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
                            "min-w-0 flex-1 bg-transparent font-normal outline-none placeholder:text-ink/35",
                            messagingField.prefix && "pl-0.5"
                          )}
                          placeholder={messagingField.placeholder}
                        />
                      </span>
                    </label>
                  </div>
                </fieldset>

                <label className="grid gap-2 text-sm font-semibold">
                  Preferred date <span className="font-normal text-ink/45">Optional</span>
                  <input
                    name="preferredDate"
                    type="date"
                    className="h-12 rounded-xl border border-ink/15 bg-card px-4 font-normal outline-none focus:border-jade"
                  />
                </label>

                <label className="grid gap-2 text-sm font-semibold">
                  Notes <span className="font-normal text-ink/45">Optional</span>
                  <textarea
                    name="notes"
                    maxLength={450}
                    rows={3}
                    className="resize-y rounded-xl border border-ink/15 bg-card px-4 py-3 font-normal outline-none placeholder:text-ink/35 focus:border-jade"
                    placeholder="Hotel area, food restrictions, preferred day shape..."
                  />
                </label>

                <label className="flex gap-3 rounded-2xl border border-ink/10 bg-card p-4 text-sm leading-6 text-ink/65">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(event) => setTermsAccepted(event.target.checked)}
                    className="mt-1 size-4 accent-vermilion"
                  />
                  <span>
                    I understand the date, restaurant availability, and meeting
                    details are confirmed after payment. If the package cannot
                    be arranged, I’ll receive alternatives or a refund.
                  </span>
                </label>

                {hasSelection && turnstileSiteKey && (
                  <TurnstileWidget
                    key={turnstileAttempt}
                    siteKey={turnstileSiteKey}
                    onTokenChange={handleTurnstileTokenChange}
                  />
                )}

                {error && (
                  <p role="alert" className="rounded-xl bg-vermilion/10 px-4 py-3 text-sm text-vermilion">
                    {error}
                  </p>
                )}
              </fieldset>
            </form>

            <div className="mt-8 border-t border-ink/10 pt-6">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-ink/55">Selected package total</span>
                <span className="font-display text-3xl">{formatYen(totalPrice)}</span>
              </div>
              <p className="mt-3 text-xs leading-5 text-ink/50">
                Your package reference is attached to the Stripe payment.
                Booking and open custom requests stay separate from the cart.
              </p>
              <div className="mt-5 grid gap-3">
                <Button
                  type="button"
                  onClick={() => formRef.current?.requestSubmit()}
                  disabled={
                    cartItems.length === 0 ||
                    submitting ||
                    !termsAccepted ||
                    !turnstileToken
                  }
                  className="h-12 rounded-full bg-ink px-6 text-paper hover:bg-vermilion disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" />
                      Opening Stripe...
                    </>
                  ) : (
                    <>
                      Pay {formatYen(totalPrice)}
                      <ArrowUpRight />
                    </>
                  )}
                </Button>
                <Link
                  href="/request"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "h-12 rounded-full border-ink/15 bg-transparent px-6"
                  )}
                >
                  <CalendarDays />
                  Custom request instead
                </Link>
                <p className="flex items-center justify-center gap-2 text-xs text-ink/45">
                  {turnstileToken ? (
                    <ShieldCheck className="size-3.5 text-jade" />
                  ) : (
                    <LockKeyhole className="size-3.5" />
                  )}
                  Card details are handled securely by Stripe
                </p>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
