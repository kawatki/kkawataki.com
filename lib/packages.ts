export type PackageItem = {
  id: string
  title: string
  shortTitle: string
  durationHours: number
  pricePerPerson: number
  maxPeople: number
  icon: "crown" | "scissors"
  highlights: string[]
  route: string[]
}

export type PackageCartLine = {
  packageId: string
  quantity: number
}

export type PackageCheckout = {
  email: string
  name: string
  notes: string
  preferredDate: string
  socialHandle: string
  socialPlatform: "discord" | "instagram" | "line" | "whatsapp" | "x"
  termsAccepted: boolean
  lines: Array<PackageCartLine & { item: PackageItem; lineTotalJpy: number }>
  totalJpy: number
}

export const packageItems: PackageItem[] = [
  {
    id: "tour-guide-luxury-sushi",
    title: "Tour guide + Luxury Sushi restaurant",
    shortTitle: "Guide + Sushi",
    durationHours: 7,
    pricePerPerson: 100000,
    maxPeople: 4,
    icon: "crown",
    highlights: [
      "Date can be adjusted after request",
      "Planning happens on your preferred messaging app",
      "Guided around the eastern side of Tokyo",
      "Luxury places, refined food, and polished local context",
    ],
    route: ["Eastern Tokyo", "Luxury districts", "Sushi reservation"],
  },
  {
    id: "denim-kimono-luxury-sushi",
    title: "Tailor made denim kimono + Luxury Sushi restaurant",
    shortTitle: "Denim Kimono + Sushi",
    durationHours: 7,
    pricePerPerson: 150000,
    maxPeople: 3,
    icon: "scissors",
    highlights: [
      "Date can be adjusted after request",
      "Planning happens on your preferred messaging app",
      "Guided around the eastern side of Tokyo",
      "Tailor-made denim kimono experience with luxury sushi",
    ],
    route: ["Design consult", "Eastern Tokyo", "Sushi reservation"],
  },
]

export function formatYen(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(amount)
}

export function createPackageReference() {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
  const random = crypto.getRandomValues(new Uint8Array(8))
  const characters = Array.from(
    random,
    (value) => alphabet[value % alphabet.length]
  )
  return `RJG-PKG-${characters.slice(0, 4).join("")}-${characters
    .slice(4)
    .join("")}`
}

export function parsePackageCheckout(value: unknown): PackageCheckout {
  if (!value || typeof value !== "object") {
    throw new Error("Please complete the package checkout form.")
  }

  const input = value as Record<string, unknown>
  const name = typeof input.name === "string" ? input.name.trim() : ""
  const email =
    typeof input.email === "string" ? input.email.trim().toLowerCase() : ""
  const notes = typeof input.notes === "string" ? input.notes.trim() : ""
  const preferredDate =
    typeof input.preferredDate === "string" ? input.preferredDate.trim() : ""
  let socialPlatform: PackageCheckout["socialPlatform"]
  if (
    input.socialPlatform === "discord" ||
    input.socialPlatform === "instagram" ||
    input.socialPlatform === "line" ||
    input.socialPlatform === "whatsapp" ||
    input.socialPlatform === "x"
  ) {
    socialPlatform = input.socialPlatform
  } else {
    throw new Error("Choose a messaging app.")
  }

  const rawSocialHandle =
    typeof input.socialHandle === "string" ? input.socialHandle.trim() : ""
  const usesAtPrefix =
    socialPlatform === "discord" ||
    socialPlatform === "instagram" ||
    socialPlatform === "x"
  const contactValue = usesAtPrefix
    ? rawSocialHandle.replace(/^@+/u, "")
    : rawSocialHandle
  const socialHandle = !contactValue
    ? ""
    : usesAtPrefix
      ? `@${contactValue}`
      : contactValue

  const rawLines = Array.isArray(input.lines) ? input.lines : []
  const lines = rawLines.map((line) => {
    const rawLine = line as Record<string, unknown>
    const packageId =
      typeof rawLine.packageId === "string" ? rawLine.packageId.trim() : ""
    const quantity =
      typeof rawLine.quantity === "number"
        ? rawLine.quantity
        : typeof rawLine.quantity === "string"
          ? Number(rawLine.quantity)
          : Number.NaN
    const item = packageItems.find((candidate) => candidate.id === packageId)

    if (!item || !Number.isInteger(quantity)) {
      throw new Error("Choose a valid package.")
    }
    if (quantity < 1 || quantity > item.maxPeople) {
      throw new Error(`Choose 1-${item.maxPeople} guests for ${item.shortTitle}.`)
    }

    return {
      item,
      lineTotalJpy: item.pricePerPerson * quantity,
      packageId,
      quantity,
    }
  })

  const totalJpy = lines.reduce((sum, line) => sum + line.lineTotalJpy, 0)
  const termsAccepted = input.termsAccepted === true

  if (name.length < 2 || name.length > 80) {
    throw new Error("Enter your name.")
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error("Enter a valid email address.")
  }
  if (!lines.length) {
    throw new Error("Add a package to your cart.")
  }
  if (notes.length > 450) {
    throw new Error("Please keep your note under 450 characters.")
  }
  if (preferredDate && !/^\d{4}-\d{2}-\d{2}$/u.test(preferredDate)) {
    throw new Error("Choose a valid preferred date.")
  }
  if (
    socialPlatform === "instagram" &&
    !/^@[A-Za-z0-9._]{1,30}$/u.test(socialHandle)
  ) {
    throw new Error("Enter a valid Instagram username.")
  }
  if (socialPlatform === "x" && !/^@[A-Za-z0-9_]{1,15}$/u.test(socialHandle)) {
    throw new Error("Enter a valid X username.")
  }
  if (
    socialPlatform === "discord" &&
    !/^@[A-Za-z0-9._]{2,32}$/u.test(socialHandle)
  ) {
    throw new Error("Enter a valid Discord username.")
  }
  if (
    socialPlatform === "line" &&
    !/^[A-Za-z0-9._-]{1,80}$/u.test(socialHandle)
  ) {
    throw new Error("Enter a valid LINE ID.")
  }
  if (
    socialPlatform === "whatsapp" &&
    !/^\+?[0-9 ()-]{7,30}$/u.test(socialHandle)
  ) {
    throw new Error("Enter a valid WhatsApp phone number.")
  }
  if (!termsAccepted) {
    throw new Error("Please confirm the package payment terms.")
  }

  return {
    email,
    lines,
    name,
    notes,
    preferredDate,
    socialHandle,
    socialPlatform,
    termsAccepted,
    totalJpy,
  }
}
