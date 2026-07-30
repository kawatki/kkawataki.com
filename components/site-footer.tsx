import Link from "next/link"

export function SiteFooter() {
  return (
    <footer className="border-t border-ink/10 bg-paper">
      <div className="page-shell grid gap-10 py-12 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-vermilion font-display text-lg text-white">
              日
            </span>
            <span className="font-display text-2xl">Rental Japanese Guy</span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-6 text-ink/55">
            Personal company and local context for a more human day in Tokyo.
          </p>
        </div>
        <div className="flex gap-5 text-sm font-medium text-ink/60">
          <Link href="/" className="hover:text-ink">Home</Link>
          <Link href="/about" className="hover:text-ink">About</Link>
          <Link href="/booking" className="hover:text-ink">Booking</Link>
        </div>
      </div>
      <div className="border-t border-ink/10">
        <div className="page-shell flex flex-col gap-2 py-5 text-xs text-ink/45 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Rental Japanese Guy</p>
          <p>Tokyo, Japan</p>
        </div>
      </div>
    </footer>
  )
}
