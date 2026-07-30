import Image from "next/image"

import { cn } from "@/lib/utils"

export function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      src="/kkawataki-logo.png"
      width={320}
      height={320}
      alt=""
      className={cn(
        "rounded-full bg-white object-cover ring-1 ring-ink/10",
        className
      )}
    />
  )
}
