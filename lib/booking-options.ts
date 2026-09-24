export type BookingOptions = {
  peopleCount: number
  faceRecordingConsent: boolean
  surroundingsRecordingConsent: boolean
}

export function bookingPriceMultiplier(peopleCount: number, surroundingsRecordingConsent: boolean) {
  if (!Number.isInteger(peopleCount) || peopleCount < 1 || peopleCount > 6) {
    throw new Error("Choose between 1 and 6 people.")
  }
  if (typeof surroundingsRecordingConsent !== "boolean") throw new Error("Choose your recording preference.")
  return Math.ceil(peopleCount / 3) * (surroundingsRecordingConsent ? 1 : 1.2)
}

export function parseBookingOptions(input: Record<string, unknown>): BookingOptions {
  if (typeof input.peopleCount !== "number" || typeof input.faceRecordingConsent !== "boolean" || typeof input.surroundingsRecordingConsent !== "boolean") {
    throw new Error("Please complete the group size and recording preferences.")
  }
  bookingPriceMultiplier(input.peopleCount, input.surroundingsRecordingConsent)
  return { peopleCount: input.peopleCount, faceRecordingConsent: input.faceRecordingConsent, surroundingsRecordingConsent: input.surroundingsRecordingConsent }
}
