"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { Dialog } from "@base-ui/react/dialog"
import { ArrowUpRight, Menu, X } from "lucide-react"

import { BrandMark } from "@/components/brand-mark"
import { ThemeToggle } from "@/components/theme-toggle"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const navigation = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/booking", label: "Booking" },
]

export function SiteHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const touchStartX = useRef<number | null>(null)

  return (
    <header className="sticky top-0 z-50 border-b border-ink/10 bg-paper/90 backdrop-blur-xl">
      <div className="page-shell flex h-[76px] items-center justify-between gap-4">
        <Link href="/" className="group flex items-center gap-3" aria-label="Rental Japanese Guy home">
          <BrandMark className="size-9 transition-transform group-hover:-rotate-6" />
          <span className="hidden font-display text-xl tracking-tight sm:block">
            Rental Japanese Guy
          </span>
        </Link>

        <nav
          className="hidden items-center gap-1 sm:flex"
          aria-label="Primary navigation"
        >
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

        <div className="flex items-center gap-2">
          <ThemeToggle />
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

          <Dialog.Root open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <Dialog.Trigger
              aria-label="Open navigation menu"
              className="flex size-11 items-center justify-center rounded-full border border-ink/15 bg-card/70 text-ink transition hover:border-ink/30 hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vermilion sm:hidden"
            >
              <Menu className="size-5" aria-hidden="true" />
            </Dialog.Trigger>

            <Dialog.Portal>
              <Dialog.Backdrop className="fixed inset-0 z-[60] min-h-dvh bg-ink/35 backdrop-blur-sm transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
              <Dialog.Popup
                onTouchStart={(event) => {
                  touchStartX.current = event.touches[0]?.clientX ?? null
                }}
                onTouchEnd={(event) => {
                  const endX = event.changedTouches[0]?.clientX
                  if (
                    touchStartX.current !== null &&
                    endX !== undefined &&
                    endX - touchStartX.current > 72
                  ) {
                    setMobileMenuOpen(false)
                  }
                  touchStartX.current = null
                }}
                className="fixed inset-y-0 right-0 z-[70] flex w-[calc(100%-3.5rem)] max-w-sm touch-pan-y flex-col overflow-y-auto border-l border-ink/10 bg-paper p-6 shadow-2xl shadow-black/30 transition-transform duration-300 ease-out data-ending-style:translate-x-full data-starting-style:translate-x-full"
              >
                <Dialog.Title className="sr-only">Navigation menu</Dialog.Title>

                <div className="flex items-center justify-between gap-4">
                  <Link
                    href="/"
                    onClick={() => setMobileMenuOpen(false)}
                    className="group flex items-center gap-3"
                    aria-label="Rental Japanese Guy home"
                  >
                    <BrandMark className="size-10" />
                    <span className="font-display text-lg tracking-tight">
                      Rental Japanese Guy
                    </span>
                  </Link>
                  <Dialog.Close
                    aria-label="Close navigation menu"
                    className="flex size-11 shrink-0 items-center justify-center rounded-full border border-ink/15 bg-card text-ink transition hover:border-ink/30 hover:bg-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vermilion"
                  >
                    <X className="size-5" aria-hidden="true" />
                  </Dialog.Close>
                </div>

                <nav
                  className="mt-12 grid border-t border-ink/10"
                  aria-label="Mobile navigation"
                >
                  {navigation.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="border-b border-ink/10 py-6 font-display text-4xl leading-none tracking-tight text-ink transition hover:text-vermilion"
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>

                <div className="mt-auto pt-10">
                  <Link
                    href="/booking"
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      buttonVariants({ size: "lg" }),
                      "h-13 w-full rounded-full bg-ink px-6 text-paper hover:bg-vermilion hover:text-white"
                    )}
                  >
                    Book your time
                    <ArrowUpRight />
                  </Link>
                  <p className="mt-4 text-center text-xs leading-5 text-ink/45">
                    Tokyo, without the tourist script.
                  </p>
                </div>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </div>
    </header>
  )
}
