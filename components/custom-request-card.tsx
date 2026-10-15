import Link from "next/link"
import { ArrowRight } from "lucide-react"

export function CustomRequestCard() {
  return (
    <Link
      href="/request"
      className="block rounded-2xl border border-ink/15 p-5 text-left text-ink transition hover:border-jade/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jade"
    >
      <span className="flex items-center justify-between gap-3">
        <span className="font-display text-2xl">Custom Request</span>
        <ArrowRight className="size-5 shrink-0" aria-hidden="true" />
      </span>
      <span className="mt-2 block font-semibold">Your own plan</span>
      <span className="mt-1 block text-sm leading-6 text-ink/60">
        Something beyond the set experiences? Arrange the details and price with me first.
      </span>
      <span className="mt-3 block text-xs text-ink/60">
        Continue to custom payment after we’ve agreed →
      </span>
    </Link>
  )
}
