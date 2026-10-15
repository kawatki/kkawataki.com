"use client"

import { ErrorToast } from "@/components/ui/toast"
import { useEffect, useId, useRef, useState } from "react"
import { LoaderCircle, ShieldCheck } from "lucide-react"

type TurnstileApi = {
  remove(widgetId: string): void
  render(
    container: HTMLElement,
    options: {
      action: string
      callback(token: string): void
      "error-callback"(): void
      "expired-callback"(): void
      sitekey: string
      size: "flexible"
      theme: "auto"
    }
  ): string
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const SCRIPT_ID = "cloudflare-turnstile-script"
const SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"

function loadTurnstile() {
  if (window.turnstile) {
    return Promise.resolve()
  }

  return new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(
      SCRIPT_ID
    ) as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true })
      existing.addEventListener("error", () => reject(), { once: true })
      return
    }

    const script = document.createElement("script")
    script.id = SCRIPT_ID
    script.src = SCRIPT_URL
    script.async = true
    script.defer = true
    script.addEventListener("load", () => resolve(), { once: true })
    script.addEventListener("error", () => reject(), { once: true })
    document.head.append(script)
  })
}

export function TurnstileWidget({
  onTokenChange,
  siteKey,
  action = "checkout",
  message = "Verifying this booking is being made by a person…",
}: {
  onTokenChange(token: string): void
  siteKey: string
  action?: string
  message?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const reactId = useId()
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    onTokenChange("")

    void loadTurnstile()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          action,
          callback: (token) => {
            setLoading(false)
            setFailed(false)
            onTokenChange(token)
          },
          "error-callback": () => {
            setLoading(false)
            setFailed(true)
            onTokenChange("")
          },
          "expired-callback": () => {
            setLoading(false)
            setFailed(true)
            onTokenChange("")
          },
          sitekey: siteKey,
          size: "flexible",
          theme: "auto",
        })
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false)
          setFailed(true)
          onTokenChange("")
        }
      })

    return () => {
      cancelled = true
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
      }
    }
  }, [onTokenChange, reactId, siteKey, action])

  return (
    <div className="rounded-xl border border-ink/15 bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <ShieldCheck className="size-4 text-jade" />
        Security check
      </div>
      <div ref={containerRef} className="mt-3 min-h-[65px]" />
      {loading && (
        <p className="mt-2 flex items-center gap-2 text-xs text-ink/50">
          <LoaderCircle className="size-3.5 animate-spin" />
          {message}
        </p>
      )}
      {failed && (
        <ErrorToast>
          The security check expired or could not load. Close this notice and
          try again.
        </ErrorToast>
      )}
    </div>
  )
}
