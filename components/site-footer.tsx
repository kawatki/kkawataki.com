import type { SVGProps } from "react"
import Link from "next/link"

import { BrandMark } from "@/components/brand-mark"

const navigation = {
  main: [
    { name: "Home", href: "/" },
    { name: "About", href: "/about" },
    { name: "Booking", href: "/booking" },
    { name: "Request", href: "/request" },
  ],
  social: [
    {
      name: "Instagram",
      href: "https://www.instagram.com/kkawataki",
      icon: (props: SVGProps<SVGSVGElement>) => (
        <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
          <path
            fillRule="evenodd"
            d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 0 1 1.772 1.153 4.902 4.902 0 0 1 1.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 0 1-1.153 1.772 4.902 4.902 0 0 1-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 0 1-1.772-1.153 4.902 4.902 0 0 1-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 0 1 1.153-1.772A4.902 4.902 0 0 1 5.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63Zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 0 0-.748-1.15 3.098 3.098 0 0 0-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058ZM12 6.865a5.135 5.135 0 1 1 0 10.27 5.135 5.135 0 0 1 0-10.27Zm0 1.802a3.333 3.333 0 1 0 0 6.666 3.333 3.333 0 0 0 0-6.666Zm5.338-3.205a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    {
      name: "YouTube",
      href: "https://www.youtube.com/@kawataki",
      icon: (props: SVGProps<SVGSVGElement>) => (
        <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
          <path
            fillRule="evenodd"
            d="M19.812 5.418c.861.23 1.538.907 1.768 1.768C21.998 8.746 22 12 22 12s0 3.255-.418 4.814a2.504 2.504 0 0 1-1.768 1.768c-1.56.419-7.814.419-7.814.419s-6.255 0-7.814-.419a2.505 2.505 0 0 1-1.768-1.768C2 15.255 2 12 2 12s0-3.255.417-4.814a2.507 2.507 0 0 1 1.768-1.768C5.744 5 11.998 5 11.998 5s6.255 0 7.814.418ZM15.194 12 10 15V9l5.194 3Z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    {
      name: "X",
      href: "https://x.com/kkawataki",
      icon: (props: SVGProps<SVGSVGElement>) => (
        <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
          <path d="M13.682 10.622 20.239 3h-1.554l-5.693 6.618L8.445 3H3.2l6.877 10.007L3.2 21h1.554l6.012-6.989L15.568 21h5.245l-7.131-10.378Zm-2.128 2.474-.697-.997-5.543-7.929H7.7l4.474 6.399.697.996 5.815 8.319H16.3l-4.746-6.788Z" />
        </svg>
      ),
    },
    {
      name: "TikTok",
      href: "https://www.tiktok.com/@kkawataki",
      icon: (props: SVGProps<SVGSVGElement>) => (
        <svg
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          {...props}
        >
          <path d="M15 4v10.5a4.5 4.5 0 1 1-4.5-4.5" />
          <path d="M15 4c.7 2.1 2.3 3.7 4.5 4.2" />
        </svg>
      ),
    },
  ],
}

export function SiteFooter() {
  return (
    <footer className="border-t border-ink/10 bg-paper">
      <div className="page-shell overflow-hidden py-14 sm:py-16">
        <div className="flex flex-col items-center text-center">
          <Link
            href="/"
            className="group flex items-center gap-3"
            aria-label="Rental Japanese Guy home"
          >
            <BrandMark className="size-10 transition-transform duration-200 group-hover:scale-105" />
            <span className="font-display text-2xl sm:text-[1.7rem]">
              Rental Japanese Guy
            </span>
          </Link>
          <p className="mt-4 max-w-md text-sm leading-6 text-ink/55">
            Personal company and local context for a more human day in Tokyo.
          </p>
        </div>

        <nav
          aria-label="Footer"
          className="mt-10 flex flex-wrap justify-center gap-x-9 gap-y-3 text-sm font-medium"
        >
          {navigation.main.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="text-ink/60 transition-colors hover:text-ink"
            >
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="mt-9 flex justify-center gap-3">
          {navigation.social.map((item) => (
            <a
              key={item.name}
              href={item.href}
              target="_blank"
              rel="noreferrer"
              aria-label={`Follow Keisuke Kawataki on ${item.name}`}
              className="grid size-11 place-items-center rounded-full border border-ink/15 text-ink/55 transition-colors hover:border-ink/30 hover:bg-cream hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vermilion"
            >
              <item.icon aria-hidden="true" className="size-5" />
            </a>
          ))}
        </div>
      </div>

      <div className="border-t border-ink/10">
        <div className="page-shell flex flex-col items-center gap-1.5 py-5 text-xs text-ink/45 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} Rental Japanese Guy</p>
          <p>Tokyo, Japan</p>
        </div>
      </div>
    </footer>
  )
}
