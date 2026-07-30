import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Compass, MessageCircle, UsersRound } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "About",
  description:
    "The thinking behind Rental Japanese Guy: personal company and a more human way to experience Tokyo.",
}

const principles = [
  {
    icon: MessageCircle,
    title: "Conversation first",
    copy: "Questions are welcome. The best days leave room to notice things, change direction, and talk.",
  },
  {
    icon: Compass,
    title: "Your interests lead",
    copy: "Food, design, subculture, ordinary neighborhoods, or simply having local company—the day starts with you.",
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
            Japan is easier to understand with someone beside you.
          </h1>
          <p className="mt-10 max-w-2xl text-lg leading-8 text-ink/65">
            Rental Japanese Guy is for visitors who want something between
            wandering alone and joining a formal tour: local company, honest
            conversation, and a day with room to breathe.
          </p>
        </div>
      </section>

      <section className="page-shell grid gap-12 py-20 sm:py-28 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="eyebrow">Why it exists</p>
          <h2 className="mt-4 font-display text-5xl leading-[0.95] tracking-tight">
            The city behind the checklist.
          </h2>
        </div>
        <div className="space-y-6 text-lg leading-8 text-ink/70">
          <p>
            Travel can become a race between famous places. But the moments
            people remember are often smaller: understanding what is happening
            around them, finding somewhere they would never have entered alone,
            or finally asking the questions that guidebooks do not answer.
          </p>
          <p>
            This service keeps the structure intentionally light. You bring an
            idea—or just curiosity—and we turn four hours into something that
            feels personal.
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
              Ready when you are
            </p>
            <h2 className="mt-4 max-w-2xl font-display text-5xl leading-[0.95] tracking-tight">
              Let’s make Tokyo feel a little more familiar.
            </h2>
          </div>
          <Link
            href="/booking"
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-12 rounded-full bg-paper px-6 text-ink hover:bg-white"
            )}
          >
            Check availability
            <ArrowRight />
          </Link>
        </div>
      </section>
    </>
  )
}
