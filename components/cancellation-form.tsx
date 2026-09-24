"use client"

import { useCallback, useState, type FormEvent } from "react"
import { TurnstileWidget } from "@/components/turnstile-widget"
import { Button } from "@/components/ui/button"

type Cancellation = {
  reference: string
  slotStart: string
  amountPaidJpy: number
  refundAmountJpy: number
  refundPercent: number
  quote?: string
  legacyPolicy?: boolean
  requested: boolean
  cancelled?: boolean
  refundStatus?: string
}
const yen = (amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "JPY" }).format(amount)
const inputClass = "mt-2 w-full rounded-xl border border-ink/20 bg-paper px-4 py-3 text-base focus:outline-2 focus:outline-vermilion"

export function CancellationForm({ turnstileSiteKey }: { turnstileSiteKey: string }) {
  const [turnstileToken, setTurnstileToken] = useState("")
  const [turnstileAttempt, setTurnstileAttempt] = useState(0)
  const handleToken = useCallback((token: string) => setTurnstileToken(token), [])
  const [email, setEmail] = useState("")
  const [reference, setReference] = useState("")
  const [result, setResult] = useState<Cancellation | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function submit(confirm: boolean) {
    if (busy) return
    if (!turnstileToken) { setError("Complete the security check before continuing."); return }
    setBusy(true)
    setError("")
    try {
      const response = await fetch("/api/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ turnstileToken, email, reference, action: confirm ? "confirm" : "preview", quote: result?.quote }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Cancellation is temporarily unavailable.")
      setResult(data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to connect. Please try again.")
    } finally {
      setTurnstileToken("")
      setTurnstileAttempt((attempt) => attempt + 1)
      setBusy(false)
    }
  }

  function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submit(false)
  }

  const needsAttention = ["failed", "canceled", "needs_attention", "requires_action"].includes(result?.refundStatus ?? "")
  const securityCheck = turnstileSiteKey ? <TurnstileWidget key={turnstileAttempt} siteKey={turnstileSiteKey} action="cancellation" message="Verifying this request is being made by a person…" onTokenChange={handleToken} /> : <p role="alert">The security check is temporarily unavailable. Please contact me for help cancelling your booking.</p>
  return (
    <div className="mt-8 rounded-3xl border border-ink/15 bg-card p-6 sm:p-8">
      <form onSubmit={lookup} className="space-y-5">
        <label className="block text-base font-medium">Booking email
          <input className={inputClass} type="email" autoComplete="email" required maxLength={254} placeholder="your@email.com" value={email} disabled={busy || Boolean(result)} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="block text-base font-medium">Booking reference
          <input className={`${inputClass} font-mono uppercase`} type="text" autoCapitalize="characters" autoComplete="off" spellCheck={false} required maxLength={13} placeholder="RJG-2345-ABCD" value={reference} disabled={busy || Boolean(result)} onChange={(event) => setReference(event.target.value.toUpperCase())} />
        </label>
        {!result && <div>{securityCheck}</div>}
        {!result && <Button type="submit" disabled={busy || !turnstileToken} className="h-12 w-full rounded-full">{busy ? "Finding your booking…" : "Find my booking"}</Button>}
      </form>
      {error && <p role="alert" className="mt-5 text-base text-vermilion">{error}</p>}
      {result && <div className="mt-7 border-t border-ink/15 pt-6" aria-live="polite">
        <h2 className="font-display text-2xl">{result.requested ? result.cancelled ? "Booking cancelled" : "Cancellation received" : "Review your cancellation"}</h2>
        <p className="mt-3 text-base">{new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Tokyo" }).format(new Date(result.slotStart))} JST</p>
        <dl className="mt-5 space-y-3 text-base">
          <div className="flex justify-between gap-4"><dt>Amount paid</dt><dd>{yen(result.amountPaidJpy)}</dd></div>
          <div className="flex justify-between gap-4 font-semibold"><dt>Refund · {result.refundPercent}%</dt><dd>{yen(result.refundAmountJpy)}</dd></div>
        </dl>
        {result.legacyPolicy && <p className="mt-4 text-sm leading-6 text-ink/65">This booking was made under the previous non-refundable policy.</p>}
        {(!result.requested || !result.cancelled || !["succeeded", "not_due"].includes(result.refundStatus ?? "")) && <div className="mt-5">{securityCheck}</div>}
        {result.requested ? <>
          <p className="mt-5 text-base leading-7">{!result.cancelled ? "Your request is saved. The calendar update is still processing." : "Your time has been released. Thank you for letting me know."}</p>
          <p className="mt-3 text-base leading-7">{needsAttention ? "Your refund needs attention. Please contact me with your booking reference so I can help." : result.refundStatus === "succeeded" ? "Your refund has been sent to your original payment method. Your bank may take several days to show it." : result.refundAmountJpy === 0 ? "No refund is due under your booking’s cancellation policy." : "Your refund is processing. You can check its status here using the same details."}</p>
          {(!result.cancelled || !["succeeded", "not_due"].includes(result.refundStatus ?? "")) && <Button className="mt-5 rounded-full" disabled={busy || !turnstileToken} onClick={() => submit(true)}>{busy ? "Checking…" : "Check status"}</Button>}
        </> : <>
          <p className="mt-5 text-base leading-7 text-ink/65">Confirming cancels this booking and releases the calendar slot. This cannot be undone.{result.refundAmountJpy > 0 && " The refund goes to your original payment method."}</p>
          <Button className="mt-6 h-12 w-full rounded-full bg-vermilion text-white hover:bg-vermilion/90" disabled={busy || !turnstileToken} onClick={() => submit(true)}>{busy ? "Cancelling…" : "Confirm cancellation"}</Button>
        </>}
        {!result.requested && <button type="button" className="mt-4 w-full text-sm underline" disabled={busy} onClick={() => { setResult(null); setError("") }}>Go back — keep my booking</button>}
      </div>}
    </div>
  )
}
