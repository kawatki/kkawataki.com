"use client"

import { useState } from "react"
import { Dialog } from "@base-ui/react/dialog"
import { Info, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export function BookingPriceNotice({ initiallyOpen = true, attention = false }: { initiallyOpen?: boolean; attention?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen)

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger render={<Button type="button" variant="ghost" className={`cursor-pointer justify-self-start font-bold text-md text-vermilion ${attention ? "booking-price-notice-nudge" : ""}`} onClick={() => setOpen(true)} />}>
          <Info className="size-4" aria-hidden="true" />
          How pricing works
        </TooltipTrigger>
        <TooltipContent>
          See the rate and payment breakdown.
        </TooltipContent>
      </Tooltip>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm transition-opacity duration-200 ease-out data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 motion-reduce:transition-none" />
        <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
          <Dialog.Popup className="relative max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl border border-border bg-card p-6 text-card-foreground shadow-2xl outline-none transition-[opacity,transform,scale,translate] duration-200 ease-out data-[starting-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:translate-y-2 data-[ending-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:translate-y-2 motion-reduce:transition-none motion-reduce:transform-none motion-reduce:scale-100 motion-reduce:translate-y-0 sm:p-8">
            <Dialog.Close render={<Button variant="ghost" size="icon" className="absolute right-3 top-3" />} aria-label="Close pricing note">
              <X className="size-5" />
            </Dialog.Close>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Clear pricing</p>
            <Dialog.Title className="mt-4 pr-5 font-display text-3xl leading-tight">¥1,000 per 30 minutes.</Dialog.Title>
            <Dialog.Description render={<div />} className="mt-5 text-sm leading-7 text-muted-foreground">
              <p>The base experience rate is ¥1,000 per 30 minutes before tax, for 1–3 guests with video participation.</p>
            </Dialog.Description>
            <div className="mt-3 space-y-3 text-sm leading-7 text-muted-foreground">
              <p>Choose 4, 8, or 14 hours. Transportation is ¥4,000 per booking before tax. A 10% tax is added to the total.</p>
              <p>For 4–6 guests, the experience fee doubles. Choosing not to appear in videos adds 20% to the experience fee.</p>
              <p>Pay 50% online to reserve your time, then pay the remaining balance in person. You’ll see the full total and deposit before paying.</p>
            </div>
            <Dialog.Close render={<Button className="mt-6 w-full" />}>Explore dates and prices</Dialog.Close>
          </Dialog.Popup>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
