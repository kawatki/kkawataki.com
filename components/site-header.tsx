"use client"

import { useState } from "react"
import Link from "next/link"
import { Dialog } from "@base-ui/react/dialog"
import { ArrowUpRight, Menu, X } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const navigation = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/booking", label: "Booking" },
]

export function SiteHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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
            className="flex size-11 items-center justify-center rounded-full border border-ink/15 bg-white/70 text-ink transition hover:border-ink/30 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vermilion sm:hidden"
          >
            <Menu className="size-5" aria-hidden="true" />
          </Dialog.Trigger>

          <Dialog.Portal>
            <Dialog.Backdrop className="fixed inset-0 z-[60] min-h-dvh bg-ink/35 backdrop-blur-sm transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
            <Dialog.Popup className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-sm flex-col overflow-y-auto border-l border-ink/10 bg-paper p-6 shadow-2xl shadow-ink/25 transition-transform duration-300 ease-out data-ending-style:translate-x-full data-starting-style:translate-x-full">
              <Dialog.Title className="sr-only">Navigation menu</Dialog.Title>

              <div className="flex items-center justify-between gap-4">
                <Link
                  href="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className="group flex items-center gap-3"
                  aria-label="Rental Japanese Guy home"
                >
                  <span className="flex size-10 items-center justify-center rounded-full bg-vermilion font-display text-lg text-white">
                    日
                  </span>
                  <span className="font-display text-xl tracking-tight">
                    Rental Japanese Guy
                  </span>
                </Link>
                <Dialog.Close
                  aria-label="Close navigation menu"
                  className="flex size-11 shrink-0 items-center justify-center rounded-full border border-ink/15 bg-white text-ink transition hover:border-ink/30 hover:bg-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vermilion"
                >
                  <X className="size-5" aria-hidden="true" />
                </Dialog.Close>
              </div>

              <nav
                className="mt-12 grid border-t border-ink/10"
                aria-label="Mobile navigation"
              >
                {navigation.map((item, index) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="group flex items-center justify-between border-b border-ink/10 py-5 text-2xl font-medium tracking-tight text-ink transition hover:text-vermilion"
                  >
                    <span>{item.label}</span>
                    <span className="font-mono text-xs tracking-widest text-ink/35 transition group-hover:text-vermilion">
                      0{index + 1}
                    </span>
                  </Link>
                ))}
              </nav>

              <div className="mt-auto pt-10">
                <Link
                  href="/booking"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "h-13 w-full rounded-full bg-ink px-6 text-white hover:bg-vermilion"
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
    </header>
  )
}
