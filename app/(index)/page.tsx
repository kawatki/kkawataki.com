import Link from "next/link"
import {
  ArrowRight,
  CalendarCheck,
  Clock3,
  Coffee,
  MapPin,
  ShieldCheck,
  Sparkles,
} from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const experiences = [
  {
    icon: Coffee,
    title: "Your local guide",
    copy: "Explore neighborhoods, food, subculture, and everyday Tokyo with someone who actually lives here.",
  },
  {
    icon: MapPin,
    title: "Your temporary homie",
    copy: "Have someone relaxed to talk with, wander with, and share an experience you would not have alone.",
  },
  {
    icon: Sparkles,
    title: "Your practical plus-one",
    copy: "Get a second opinion, cultural context, or another person on your side when a plan feels unfamiliar.",
  },
]

const steps = [
  {
    number: "01",
    title: "Pick a time",
    copy: "Choose your own start and end time. I prefer four hours or longer, but shorter sessions open when the day is nearly full.",
  },
  {
    number: "02",
    title: "Tell me your idea",
    copy: "Share what you want to do, where you are staying, and anything I should know.",
  },
  {
    number: "03",
    title: "Secure the booking",
    copy: "Pay the small deposit through Stripe. Your time is confirmed only after payment succeeds.",
  },
]

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-ink/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(210,69,44,0.16),transparent_26%),radial-gradient(circle_at_20%_80%,rgba(32,91,77,0.10),transparent_24%)]" />
        <div className="page-shell relative grid min-h-[calc(100svh-76px)] items-center gap-12 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:py-24">
          <div className="max-w-3xl">
            <p className="eyebrow">A Japanese guy for the role you need</p>
            <h1 className="mt-6 text-balance font-display text-[clamp(4rem,10vw,8.8rem)] leading-[0.82] tracking-[-0.065em]">
              Tokyo,
              <br />
              <span className="whitespace-nowrap text-[0.57em] tracking-[-0.045em] sm:text-[0.64em]">
                with a Japanese guy
              </span>
              <br />
              <span className="text-vermilion">on your side.</span>
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-8 text-ink/70 sm:text-xl">
              Book me as your local guide, temporary homie, cultural
              translator, shopping partner, platonic plus-one, or practical
              problem-solver. Tell me what kind of experience—or help—you need,
              and we’ll shape the time around it.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/booking"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "h-12 rounded-full bg-ink px-6 text-paper hover:bg-vermilion"
                )}
              >
                See available times
                <ArrowRight />
              </Link>
              <Link
                href="/about"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "h-12 rounded-full border-ink/20 bg-transparent px-6 hover:bg-white/50 dark:hover:bg-ink/10"
                )}
              >
                How this works
              </Link>
              <Link
                href="/packages"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "h-12 rounded-full border-ink/20 bg-transparent px-6 hover:bg-white/50 dark:hover:bg-ink/10"
                )}
              >
                Package plans
              </Link>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:ml-auto">
            <div className="absolute -inset-6 rotate-3 rounded-[2.5rem] border border-vermilion/20" />
            <div className="relative overflow-hidden rounded-[2rem] bg-ink p-7 text-paper shadow-2xl shadow-ink/15 sm:p-9">
              <div className="flex items-center justify-between border-b border-paper/15 pb-6">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-paper/60">
                  Flexible booking
                </span>
                <span className="flex size-10 items-center justify-center rounded-full bg-vermilion">
                  <CalendarCheck className="size-5" />
                </span>
              </div>
              <p className="mt-8 font-display text-5xl leading-none">4+ hours</p>
              <p className="mt-3 text-sm leading-6 text-paper/65">
                Choose your own start and end time when available.
              </p>

              <div className="mt-10 grid grid-cols-7 gap-2" aria-hidden="true">
                {Array.from({ length: 28 }, (_, index) => {
                  const active = [1, 2, 4, 8, 9, 12, 15, 16, 18, 22, 23, 25].includes(index)
                  return (
                    <span
                      key={index}
                      className={cn(
                        "aspect-square rounded-[0.35rem] border border-paper/10",
                        active ? "bg-jade" : "bg-paper/8",
                        index === 18 && "bg-vermilion"
                      )}
                    />
                  )
                })}
              </div>
              <div className="mt-8 flex items-center gap-2 text-sm text-paper/60">
                <ShieldCheck className="size-4 text-jade-light" />
                Confirmed only after deposit payment
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell py-20 sm:py-28">
        <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <p className="eyebrow">What this is</p>
            <h2 className="mt-4 max-w-sm font-display text-5xl leading-[0.95] tracking-tight sm:text-6xl">
              A person for the plan—not a package tour.
            </h2>
          </div>
          <div className="grid gap-px overflow-hidden rounded-3xl border border-ink/10 bg-ink/10 md:grid-cols-3">
            {experiences.map(({ icon: Icon, title, copy }) => (
              <article key={title} className="bg-paper p-7 sm:p-8">
                <Icon className="size-6 text-vermilion" strokeWidth={1.7} />
                <h3 className="mt-10 font-display text-2xl">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-ink/65">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-jade text-paper">
        <div className="page-shell py-20 sm:py-28">
          <div className="flex flex-col justify-between gap-6 border-b border-paper/20 pb-10 md:flex-row md:items-end">
            <div>
              <p className="eyebrow text-paper/60">Simple by design</p>
              <h2 className="mt-4 font-display text-5xl tracking-tight sm:text-6xl">
                From idea to booked.
              </h2>
            </div>
            <div className="flex items-center gap-2 text-sm text-paper/65">
              <Clock3 className="size-4" />
              Takes about two minutes
            </div>
          </div>

          <div className="grid md:grid-cols-3">
            {steps.map((step) => (
              <article
                key={step.number}
                className="border-b border-paper/20 py-9 md:border-b-0 md:border-r md:px-8 md:first:pl-0 md:last:border-r-0 md:last:pr-0"
              >
                <span className="font-mono text-xs text-paper/45">{step.number}</span>
                <h3 className="mt-8 font-display text-3xl">{step.title}</h3>
                <p className="mt-3 max-w-sm text-sm leading-6 text-paper/65">
                  {step.copy}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="page-shell py-20 sm:py-28">
        <div className="rounded-[2rem] bg-vermilion px-6 py-14 text-center text-white sm:px-12 sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/65">
            Make a day of it
          </p>
          <h2 className="mx-auto mt-5 max-w-3xl text-balance font-display text-5xl leading-[0.95] tracking-tight sm:text-7xl">
            Bring a question. Leave with a story.
          </h2>
          <Link
            href="/booking"
            className={cn(
              buttonVariants({ size: "lg" }),
              "mt-9 h-12 rounded-full bg-paper px-6 text-ink hover:bg-white"
            )}
          >
            Find a time
            <ArrowRight />
          </Link>
        </div>
      </section>
    </>
  )
}
