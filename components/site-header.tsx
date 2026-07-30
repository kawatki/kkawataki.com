import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const navigation = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/booking", label: "Booking" },
]

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-ink/10 bg-paper/90 backdrop-blur-xl">
      <div className="page-shell flex h-[76px] items-center justify-between gap-4">
        <Link href="/" className="group flex items-center gap-3" aria-label="Rental Japanese Guy home">
          <span className="flex size-9 items-center justify-center rounded-full bg-vermilion font-display text-lg text-white transition-transform group-hover:-rotate-6">
            日
          </span>
          <span className="hidden font-display text-xl tracking-tight sm:block">
            Rental Japanese Guy
          </span>
        </Link>

        <nav className="flex items-center gap-1" aria-label="Primary navigation">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-3 py-2 text-sm font-medium text-ink/65 transition-colors hover:bg-ink/5 hover:text-ink sm:px-4"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/booking"
          className={cn(
            buttonVariants({ size: "lg" }),
            "hidden h-10 rounded-full bg-ink px-4 hover:bg-vermilion md:inline-flex"
          )}
        >
          Book
          <ArrowUpRight />
        </Link>
      </div>
    </header>
  )
}
