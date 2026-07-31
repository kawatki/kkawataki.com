import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRight,
  Compass,
  MessageCircle,
  UsersRound,
} from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "About",
  description:
    "A flexible local companion for the role your Tokyo plan needs: guide, temporary homie, plus-one, or practical problem-solver.",
}

const principles = [
  {
    icon: MessageCircle,
    title: "Conversation first",
    copy: "Questions are welcome. The best days leave room to notice things, change direction, and talk.",
  },
  {
    icon: Compass,
    title: "Your need leads",
    copy: "A neighborhood, an unusual idea, a difficult errand, or simply wanting company—the time starts with what you need.",
  },
  {
    icon: UsersRound,
    title: "One human to another",
    copy: "No performance and no scripted character. Just respectful, relaxed time together in the city.",
  },
]

export default function AboutPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-ink/10">
        <div className="absolute right-[-10rem] top-[-10rem] size-[30rem] rounded-full border-[5rem] border-vermilion/10" />
        <div className="page-shell relative py-20 sm:py-28">
          <p className="eyebrow">About the idea</p>
          <h1 className="mt-5 max-w-5xl text-balance font-display text-6xl leading-[0.9] tracking-[-0.045em] sm:text-8xl">
            The Japanese guy your plan needs.
          </h1>
          <p className="mt-10 max-w-3xl text-lg leading-8 text-ink/65">
            Some people need a guide. Others want a temporary homie, a second
            opinion, help navigating an unfamiliar situation, or simply
            someone fun to share Tokyo with. Rental Japanese Guy is
            intentionally flexible: you bring the idea, question, or problem,
            and we work out the role that makes your day better.
          </p>
        </div>
      </section>

      <section className="page-shell grid gap-12 py-20 sm:py-28 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="eyebrow">Why it exists</p>
          <h2 className="mt-4 font-display text-5xl leading-[0.95] tracking-tight">
            Some plans are better with backup.
          </h2>
        </div>
        <div className="space-y-6 text-lg leading-8 text-ink/70">
          <p>
            Being in an unfamiliar country can turn a simple plan into a
            challenge. Sometimes you need local knowledge. Sometimes you need
            another perspective. Sometimes you just want someone beside you
            while you try something unusual.
          </p>
          <p>
            This service keeps the structure intentionally light. You bring the
            plan—or just curiosity—and we shape the role and the time around
            what would genuinely help.
          </p>
        </div>
      </section>

      <section className="border-y border-ink/10 bg-cream">
        <div className="page-shell grid gap-px py-16 md:grid-cols-3">
          {principles.map(({ icon: Icon, title, copy }, index) => (
            <article
              key={title}
              className={cn(
                "py-8 md:px-8",
                index > 0 && "border-t border-ink/10 md:border-l md:border-t-0",
                index === 0 && "md:pl-0",
                index === principles.length - 1 && "md:pr-0"
              )}
            >
              <Icon className="size-7 text-vermilion" strokeWidth={1.6} />
              <h3 className="mt-10 font-display text-3xl">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-ink/60">{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="page-shell py-20 sm:py-28">
        <div className="grid items-center gap-10 rounded-[2rem] bg-jade p-7 text-paper sm:p-12 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-paper/55">
              Questions are welcome
            </p>
            <h2 className="mt-4 max-w-2xl font-display text-5xl leading-[0.95] tracking-tight">
              Not sure whether your idea fits?
            </h2>
            <p className="mt-5 max-w-2xl text-sm leading-6 text-paper/65 sm:text-base">
              Questions and unusual requests are welcome. Message me on
              Instagram before booking and tell me what you have in mind.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <a
              href="https://www.instagram.com/kkawataki"
              target="_blank"
              rel="noreferrer"
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-12 rounded-full bg-paper px-6 text-ink hover:bg-white dark:hover:bg-cream"
              )}
            >
              <MessageCircle />
              Message me on Instagram
            </a>
            <Link
              href="/booking"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-12 rounded-full border-paper/30 bg-transparent px-6 text-paper hover:bg-paper/10 hover:text-paper"
              )}
            >
              Check availability
              <ArrowRight />
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
