import { parsePackageIds } from "@/lib/experience-packages"
export type BookingOptions = {
  packageIds?: string[]
  peopleCount: number
  faceRecordingConsent: boolean
}

export function bookingPriceMultiplier(peopleCount: number, faceRecordingConsent: boolean) {
  if (!Number.isInteger(peopleCount) || peopleCount < 1 || peopleCount > 6) {
    throw new Error("Choose between 1 and 6 people.")
  }
  if (typeof faceRecordingConsent !== "boolean") throw new Error("Choose your recording preference.")
  return Math.ceil(peopleCount / 3) * (faceRecordingConsent ? 1 : 1.2)
}

export function parseBookingOptions(input: Record<string, unknown>): BookingOptions {
  if (typeof input.peopleCount !== "number" || typeof input.faceRecordingConsent !== "boolean") {
    throw new Error("Please complete the group size and recording preferences.")
  }
  bookingPriceMultiplier(input.peopleCount, input.faceRecordingConsent)
  return { peopleCount: input.peopleCount, faceRecordingConsent: input.faceRecordingConsent, ...(input.packageIds !== undefined ? { packageIds: parsePackageIds(input.packageIds) } : {}) }
}
